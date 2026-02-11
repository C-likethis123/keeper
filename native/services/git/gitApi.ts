export type GitChangeOperation = 'add' | 'modify' | 'delete';

export interface GitChange {
  filePath: string;
  operation: GitChangeOperation;
}

export interface CommitRequest {
  changes: GitChange[];
  message?: string;
}

export interface CommitResponse {
  success: boolean;
  commitHash?: string;
  error?: string;
}

export interface GetFileResponse {
  success: boolean;
  content?: string;
  error?: string;
}

const GIT_API_BASE_URL = process.env.EXPO_PUBLIC_GIT_API_URL;

async function request<T>(path: string, init: RequestInit): Promise<T> {
  if (!GIT_API_BASE_URL) {
    console.warn(
      '[GitApi] EXPO_PUBLIC_GIT_API_URL is not set. Skipping git operation for',
      path,
    );
    throw new Error('GIT_API_URL_NOT_CONFIGURED');
  }

  const url = `${GIT_API_BASE_URL.replace(/\/+$/, '')}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `[GitApi] Request failed for ${path} with ${response.status}: ${text}`,
    );
  }

  return (await response.json()) as T;
}

export async function commitChanges(
  changes: GitChange[],
  message?: string,
): Promise<CommitResponse> {
  if (changes.length === 0) {
    return { success: true };
  }

  try {
    const body: CommitRequest = {
      changes,
      message,
    };

    return await request<CommitResponse>('/git/commit', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(body),
    });
  } catch (error: any) {
    console.warn('[GitApi] Failed to commit changes:', error?.message ?? error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getFile(filePath: string): Promise<GetFileResponse> {
  try {
    const response = await request<GetFileResponse>(
      `/git/file?path=${encodeURIComponent(filePath)}`,
      {
        method: 'GET',
      },
    );
    return response;
  } catch (error: any) {
    console.warn('[GitApi] Failed to get file:', error?.message ?? error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}


