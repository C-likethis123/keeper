import { GitInitializationService } from "@/services/git/gitInitializationService";
import type { GitRuntimeSupport } from "@/services/git/runtime";
import { NotesIndexService } from "@/services/notes/notesIndex";
import { StorageInitializationService } from "@/services/storage/storageInitializationService";

type ShowToast = (message: string, duration?: number) => void;

interface InitializeGitStepOptions {
	backgroundMode: boolean;
	showToast: ShowToast;
	setInitError: (error: string) => void;
}

export async function initializeStorageStep(showToast: ShowToast): Promise<void> {
	const result = await StorageInitializationService.instance.initialize();
	if (result.success && result.needsRebuild) {
		await NotesIndexService.rebuildFromDisk();
	}
	if (!result.success && result.readOnlyReason) {
		showToast(`Read-only mode: ${result.readOnlyReason}`, 6000);
	}
}

export async function initializeGitStep({
	backgroundMode,
	showToast,
	setInitError,
}: InitializeGitStepOptions): Promise<void> {
	try {
		const result = await GitInitializationService.instance.initialize();
		if (!result.supported) {
			if (result.reason) {
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
				const metrics = await NotesIndexService.rebuildFromDisk();
				console.log("[App] notesIndexDbRebuildFromDisk", metrics);
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
): Promise<void> {
	if (runtimeSupport.reason) {
		showToast(runtimeSupport.reason, 6000);
	}
}
