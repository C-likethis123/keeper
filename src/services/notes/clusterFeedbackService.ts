import { NOTES_ROOT } from "@/services/notes/Notes";
import { File } from "expo-file-system";
import { getNotesIndexDb } from "./indexDb/db";
import {
	exportFeedbackToJson,
	getAllClusterFeedback,
	recordClusterFeedback,
} from "./indexDb/repository";

const FEEDBACK_FILENAME = ".moc_feedback.json";

export interface FeedbackEvent {
	clusterId: string;
	eventType: string;
	eventData: Record<string, unknown> | null;
	createdAt: number;
}

export async function logFeedback(
	clusterId: string,
	eventType:
		| "accept"
		| "dismiss"
		| "rename"
		| "merge"
		| "add_note"
		| "remove_note"
		| "delete",
	eventData: Record<string, unknown> = {},
): Promise<void> {
	const database = await getNotesIndexDb();
	await recordClusterFeedback(database, clusterId, eventType, eventData);
}

export async function exportFeedbackToFile(): Promise<void> {
	const database = await getNotesIndexDb();
	const json = await exportFeedbackToJson(database);
	const filePath = `${NOTES_ROOT}/${FEEDBACK_FILENAME}`;
	const file = new File(filePath);
	await file.write(json);
}

export async function getFeedbackHistory(): Promise<FeedbackEvent[]> {
	const database = await getNotesIndexDb();
	const feedback = await getAllClusterFeedback(database);
	return feedback.map((f) => ({
		clusterId: f.cluster_id,
		eventType: f.event_type,
		eventData: f.event_data ? JSON.parse(f.event_data) : null,
		createdAt: f.created_at,
	}));
}
