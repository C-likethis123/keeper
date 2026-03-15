import { GitInitializationService } from "@/services/git/gitInitializationService";
import type { GitRuntimeSupport } from "@/services/git/runtime";
import { NotesIndexService } from "@/services/notes/notesIndex";
import { StorageInitializationService } from "@/services/storage/storageInitializationService";
import { useStorageStore } from "@/stores/storageStore";
import type { StartupTelemetry } from "./startupTelemetry";

type ShowToast = (message: string, duration?: number) => void;

interface InitializeGitStepOptions {
	backgroundMode: boolean;
	showToast: ShowToast;
	setInitError: (error: string) => void;
}

export async function initializeStorageStep(
	showToast: ShowToast,
	telemetry: StartupTelemetry,
): Promise<void> {
	const initializeStart = telemetry.stepStarted("storage.initialize");
	const result = await StorageInitializationService.instance.initialize();
	telemetry.stepCompleted("storage.initialize", initializeStart, {
		success: result.success,
		needsRebuild: result.needsRebuild,
		hasReadOnlyReason: Boolean(result.readOnlyReason),
	});
	if (result.success && result.needsRebuild) {
		const rebuildStart = telemetry.stepStarted("storage.index_rebuild_after_init");
		const metrics = await NotesIndexService.rebuildFromDisk();
		telemetry.stepCompleted("storage.index_rebuild_after_init", rebuildStart, {
			noteCount: metrics.noteCount,
		});
		useStorageStore.getState().bumpContentVersion();
	}
	if (!result.success && result.readOnlyReason) {
		telemetry.trace("storage.read_only_mode", {
			reason: result.readOnlyReason,
		});
		showToast(`Read-only mode: ${result.readOnlyReason}`, 6000);
	}
}

export async function initializeGitStep({
	backgroundMode,
	showToast,
	setInitError,
}: InitializeGitStepOptions, telemetry: StartupTelemetry): Promise<void> {
	const initializeStart = telemetry.stepStarted("git.initialize", {
		backgroundMode,
	});
	try {
		const result = await GitInitializationService.instance.initialize({ telemetry });
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
			if (result.wasCloned) {
				console.log("[App] Git repository was cloned, indexing notes...");
				const rebuildStart = telemetry.stepStarted("git.index_rebuild_after_clone");
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
			showToast(error instanceof Error ? error.message : "Git sync failed", 6000);
			return;
		}
		setInitError(
			error instanceof Error
				? error.message
				: "Rust git initialization failed unexpectedly.",
		);
	}
}

export async function initializeUnsupportedRuntimeStep(
	runtimeSupport: GitRuntimeSupport,
	showToast: ShowToast,
	telemetry: StartupTelemetry,
): Promise<void> {
	if (runtimeSupport.reason) {
		telemetry.trace("runtime.unsupported_reason", {
			reason: runtimeSupport.reason,
		});
		showToast(runtimeSupport.reason, 6000);
	}
}
