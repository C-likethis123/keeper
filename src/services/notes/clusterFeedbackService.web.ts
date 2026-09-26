import {
	listServerClusterFeedback,
	logServerClusterFeedback,
	shouldUseServerClusters,
} from "@/services/notes/serverClusterClient";

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
		| "add_note"
		| "remove_note"
		| "delete",
	eventData: Record<string, unknown> = {},
): Promise<void> {
	if (shouldUseServerClusters()) {
		await logServerClusterFeedback(clusterId, eventType, eventData);
	}
}

export async function getFeedbackHistory(): Promise<FeedbackEvent[]> {
	return shouldUseServerClusters() ? listServerClusterFeedback() : [];
}

export async function exportFeedbackToFile(): Promise<void> {
	const feedback = await getFeedbackHistory();
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(feedback, null, 2)], { type: "application/json" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = "keeper-cluster-feedback.json";
	link.click();
	queueMicrotask(() => URL.revokeObjectURL(url));
}
