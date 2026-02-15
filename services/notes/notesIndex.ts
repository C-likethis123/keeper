// Import crypto polyfill first - required for AWS SDK v3 in React Native/Expo
import 'react-native-get-random-values';

import {
  DynamoDBClient,
  type DynamoDBClientConfig,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

export type NoteIndexStatus = "PINNED" | "UNPINNED";

export interface NoteIndexItem {
  /**
   * noteId is the file path in the git repo, for example:
   * notes/2026/meeting-123.md
   */
  noteId: string;
  /**
   * First few lines of the markdown file, used for previews in lists.
   */
  summary: string;
  /**
   * The note title, stored separately for efficient display in lists.
   */
  title?: string;
  /**
   * String status used as the partition key in the StatusIndex GSI.
   */
  status: NoteIndexStatus;
  /**
   * Used as the sort key in the StatusIndex GSI for ordered queries.
   * Typically this is the updatedAt or createdAt timestamp.
   */
  sortTimestamp: number;
  createdAt: number;
  updatedAt: number;
  /**
   * Partition key for the new AllNotesIndex GSI (constant value "NOTES").
   * Used for unified querying of all notes.
   */
  allNotesPartition?: string;
  /**
   * Composite sort key for the new AllNotesIndex GSI.
   * Format: "1#timestamp" for pinned, "0#timestamp" for unpinned.
   */
  compositeSortKey?: string;
}

export interface ListNotesResult {
  items: NoteIndexItem[];
  /**
   * Opaque cursor representing the DynamoDB LastEvaluatedKey.
   * Pass this back into listByStatus as `cursor` to fetch the next page.
   */
  cursor?: Record<string, unknown>;
}

function createDynamoDocumentClient(): DynamoDBDocumentClient {
  const region = process.env.EXPO_PUBLIC_AWS_REGION;
  if (!region) {
    throw new Error(
      "EXPO_PUBLIC_AWS_REGION is not set. Configure your AWS region in .env file."
    );
  }

  // For development: Get credentials from environment variables
  // WARNING: These will be exposed in the client bundle. For production,
  // use AWS Cognito Identity Pools or a backend API instead.
  const accessKeyId = process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS credentials are missing. Please set EXPO_PUBLIC_AWS_ACCESS_KEY_ID and EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY in your .env file.\n\n" +
      "For development, add these to native/.env:\n" +
      "EXPO_PUBLIC_AWS_ACCESS_KEY_ID=your_access_key\n" +
      "EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY=your_secret_key\n\n" +
      "For production, consider using AWS Cognito Identity Pools for secure credential management."
    );
  }

  const config: DynamoDBClientConfig = {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };

  const client = new DynamoDBClient(config);

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });
}

const TABLE_NAME = process.env.EXPO_PUBLIC_NOTES_INDEX_TABLE;
const STATUS_INDEX_NAME =
  process.env.EXPO_PUBLIC_NOTES_STATUS_INDEX;

if (!TABLE_NAME) {
  // Fail fast so misconfiguration is obvious during development.
  // In production you might want a softer behaviour.
  throw new Error(
    "EXPO_PUBLIC_NOTES_INDEX_TABLE is not set. It must contain the DynamoDB table name for the notes index."
  );
}

const docClient = createDynamoDocumentClient();

/**
 * Creates a composite sort key for the AllNotesIndex GSI.
 * Format: "1#timestamp" for pinned notes, "0#timestamp" for unpinned notes.
 * Timestamp is zero-padded to ensure consistent string length for sorting.
 */
export function createSortKey(isPinned: boolean, updatedAt: number): string {
  const prefix = isPinned ? "1" : "0";
  return `${prefix}#${updatedAt.toString().padStart(13, "0")}`;
}

export class NotesIndexService {
  static instance = new NotesIndexService();

  private constructor() { }

  async getNote(noteId: string): Promise<NoteIndexItem | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          noteId,
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as NoteIndexItem;
  }

  async upsertNote(item: NoteIndexItem): Promise<void> {
    const isPinned = item.status === "PINNED";
    const compositeSortKey = createSortKey(isPinned, item.updatedAt);

    const itemWithNewSchema: NoteIndexItem = {
      ...item,
      allNotesPartition: "NOTES",
      compositeSortKey,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: itemWithNewSchema,
      })
    );
  }

  async deleteNote(noteId: string): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          noteId,
        },
      })
    );
  }

  /**
   * List notes by status (PINNED or UNPINNED), ordered by sortTimestamp (typically updatedAt).
   * Supports pagination via the cursor parameter.
   */
  async listByStatus(
    status: NoteIndexStatus,
    limit = 20,
    cursor?: Record<string, unknown>
  ): Promise<ListNotesResult> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: STATUS_INDEX_NAME,
        KeyConditionExpression: "#status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": status,
        },
        Limit: limit,
        ScanIndexForward: false,
        ExclusiveStartKey: cursor,
      })
    );

    return {
      items: (result.Items as NoteIndexItem[]) ?? [],
      cursor: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  }

  /**
   * List all notes (pinned and unpinned) using the new AllNotesIndex GSI.
   * Results are sorted with pinned notes first, then by updatedAt descending.
   * Supports pagination via the cursor parameter.
   * If query is provided, filters notes by title containing the query string (case-sensitive).
   */
  async listAllNotes(
    limit = 20,
    cursor?: Record<string, unknown>,
    query?: string
  ): Promise<ListNotesResult> {
    try {
      const expressionAttributeNames: Record<string, string> = {
        "#pk": "allNotesPartition",
      };
      const expressionAttributeValues: Record<string, unknown> = {
        ":pk": "NOTES",
      };

      let filterExpression: string | undefined;
      if (query && query.trim().length > 0) {
        expressionAttributeNames["#title"] = "title";
        expressionAttributeValues[":query"] = query.trim();
        filterExpression = "contains(#title, :query)";
      }

      const queryParams = {
        TableName: TABLE_NAME,
        IndexName: STATUS_INDEX_NAME,
        KeyConditionExpression: "#pk = :pk",
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        FilterExpression: filterExpression,
        Limit: limit,
        ScanIndexForward: false,
        ExclusiveStartKey: cursor,
      };

      const result = await docClient.send(
        new QueryCommand(queryParams)
      );
      return {
        items: (result.Items as NoteIndexItem[]) ?? [],
        cursor: result.LastEvaluatedKey as Record<string, unknown> | undefined,
      };
    } catch (error) {
      console.warn("Failed to list all notes:", error);
      throw error;
    }
  }
}

/**
 * Extract a summary from markdown content by taking the first N non-empty lines.
 */
export function extractSummary(
  markdown: string,
  maxLines: number = 6
): string {
  const lines = markdown.split(/\r?\n/);

  const nonEmptyLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    nonEmptyLines.push(trimmed);
    if (nonEmptyLines.length >= maxLines) break;
  }

  return nonEmptyLines.join("\n");
}


