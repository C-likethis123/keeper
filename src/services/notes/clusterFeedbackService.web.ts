import { getTauriInvoke } from "@/services/storage/runtime";

export interface FeedbackEvent {
	clusterId: string;
	eventType: string;
	eventData: Record<string, unknown> | null;
	createdAt: number;
}

function invoke<T>(
	command: string,
	args?: Record<string, unknown>,
): Promise<T> {
	const fn = getTauriInvoke();
	if (!fn) throw new Error("Tauri invoke unavailable");
	return fn<T>(command, args);
}

export async function logFeedback(
	clusterId: string,
	eventType:
		| "accept"
		| "dismiss"
		| "rename"
		| "add_note"
		| "remove_note"
		| "delete",
	eventData: Record<string, unknown> = {},
): Promise<void> {
	await invoke("clusters_record_feedback", {
		clusterId,
		eventType,
		eventData: JSON.stringify(eventData),
	});
}

export async function exportFeedbackToFile(): Promise<void> {
	await invoke("clusters_export_feedback_file");
}

export async function getFeedbackHistory(): Promise<FeedbackEvent[]> {
	return invoke<FeedbackEvent[]>("clusters_get_all_feedback");
}
