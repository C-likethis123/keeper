import { GitInitializationService } from "@/services/git/gitInitializationService";
import { NotesIndexService } from "@/services/notes/notesIndex";
import { StorageInitializationService } from "@/services/storage/storageInitializationService";
import { showToast } from "@/services/toast";
import { useStorageStore } from "@/stores/storageStore";
import { isServerSyncEnabled } from "@/services/sync/config";
import type { StartupTelemetry } from "./startupTelemetry";

interface InitializeGitStepOptions {
	backgroundMode: boolean;
	setInitError: (error: string) => void;
	setStatusMessage?: (message: string) => void;
}

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

export async function initializeGitStep(
	{ backgroundMode, setInitError, setStatusMessage }: InitializeGitStepOptions,
	telemetry: StartupTelemetry,
): Promise<void> {
	if (isServerSyncEnabled()) {
		telemetry.trace("git.initialize_skipped_server_sync");
		return;
	}
	setStatusMessage?.("Syncing with GitHub...");
	const initializeStart = telemetry.stepStarted("git.initialize", {
		backgroundMode,
	});
	try {
		const result = await GitInitializationService.instance.initialize({
			telemetry,
		});
		telemetry.stepCompleted("git.initialize", initializeStart, {
			backgroundMode,
			success: result.success,
			supported: result.supported,
			wasCloned: result.wasCloned,
			...result.metrics,
		});
		if (!result.supported) {
			if (result.reason) {
				telemetry.trace("git.unsupported_runtime", {
					reason: result.reason,
				});
				showToast(result.reason, 6000);
			}
			return;
		}
		if (result.success) {
			console.log("[App] Git initialization succeeded:", {
				wasCloned: result.wasCloned,
			});

			if (result.error) {
				showToast(result.error, 6000);
			}
			if (result.wasCloned) {
				console.log("[App] Git repository was cloned, indexing notes...");
				const rebuildStart = telemetry.stepStarted(
					"git.index_rebuild_after_clone",
				);
				const metrics = await NotesIndexService.rebuildFromDisk();
				telemetry.stepCompleted("git.index_rebuild_after_clone", rebuildStart, {
					noteCount: metrics.noteCount,
				});
				console.log("[App] notesIndexDbRebuildFromDisk", metrics);
				useStorageStore.getState().bumpContentVersion();
			} else if (result.metrics.didDbSync) {
				useStorageStore.getState().bumpContentVersion();
			}
			return;
		}
		console.error("[App] Git initialization failed:", result.error);
		if (backgroundMode) {
			showToast(result.error ?? "Git sync failed", 6000);
			return;
		}
		setInitError(
			result.error ??
				"Rust git initialization failed. This runtime is unsupported.",
		);
	} catch (error) {
		telemetry.stepFailed("git.initialize", initializeStart, error, {
			backgroundMode,
		});
		console.error("[App] Git initialization error:", error);
		if (backgroundMode) {
			showToast(
				error instanceof Error ? error.message : "Git sync failed",
				6000,
			);
			return;
		}
		setInitError(
			error instanceof Error
				? error.message
				: "Rust git initialization failed unexpectedly.",
		);
	}
}
