import { useCallback } from "react";
import { exportFeedbackToFile } from "@/services/notes/clusterFeedbackService";

export function useFeedbackExport() {
	const exportFeedback = useCallback(async () => {
		try {
			await exportFeedbackToFile();
			console.log("Feedback exported to .moc_feedback.json");
		} catch (error) {
			console.error("Failed to export feedback:", error);
		}
	}, []);

	return { exportFeedback };
}
