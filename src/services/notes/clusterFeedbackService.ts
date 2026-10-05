import {
	logServerClusterFeedback,
	shouldUseServerClusters,
} from "@/services/notes/serverClusterClient";

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
