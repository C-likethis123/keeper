import { NotesIndexService } from "@/services/notes/notesIndex";
import { StorageInitializationService } from "@/services/storage/storageInitializationService";
import { useStorageStore } from "@/stores/storageStore";
import type { StartupTelemetry } from "./startupTelemetry";

export async function initializeStorageStep(
	telemetry: StartupTelemetry,
): Promise<void> {
	const initializeStart = telemetry.stepStarted("storage.initialize");
	try {
		const result = await StorageInitializationService.instance.initialize();
		telemetry.stepCompleted("storage.initialize", initializeStart, {
			success: true,
			needsRebuild: result.needsRebuild,
		});
		if (result.needsRebuild) {
			const rebuildStart = telemetry.stepStarted(
				"storage.index_rebuild_after_init",
			);
			const metrics = await NotesIndexService.rebuildFromDisk();
			telemetry.stepCompleted(
				"storage.index_rebuild_after_init",
				rebuildStart,
				{
					noteCount: metrics.noteCount,
				},
			);
			useStorageStore.getState().bumpContentVersion();
		}
	} catch (error) {
		telemetry.stepFailed("storage.initialize", initializeStart, error);
		throw error;
	}
}
