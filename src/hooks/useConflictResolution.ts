import type { GitConflictFile } from "@/services/git/engines/GitEngine";
import { ConflictDetectionService } from "@/services/git/conflictDetectionService";
import { getGitEngine } from "@/services/git/gitEngine";
import { useConflictStore } from "@/stores/conflictStore";
import { useState } from "react";

interface UseConflictResolutionReturn {
	conflicts: GitConflictFile[];
	isShowingModal: boolean;
	unresolvedCount: number;
	showConflictModal: () => void;
	hideConflictModal: () => void;
	hasUnresolvedConflicts: boolean;
}

export function useConflictResolution(): UseConflictResolutionReturn {
	const conflictStore = useConflictStore();
	const [isShowingModal, setIsShowingModal] = useState(false);

	return {
		conflicts: conflictStore.conflicts.filter((c) => !c.resolved).map((c) => c.file),
		isShowingModal,
		unresolvedCount: conflictStore.getUnresolvedCount(),
		showConflictModal: () => setIsShowingModal(true),
		hideConflictModal: () => setIsShowingModal(false),
		hasUnresolvedConflicts: conflictStore.hasUnresolvedConflicts(),
	};
}

/**
 * Detect and register conflicts after a sync operation.
 * Call this after app initialization completes.
 */
export async function detectAndRegisterConflicts(): Promise<GitConflictFile[]> {
	try {
		const engine = getGitEngine();
		const detectionService = new ConflictDetectionService(engine);

		const hasConflicts = await detectionService.hasUnresolvedConflicts();
		if (!hasConflicts) {
			return [];
		}

		const conflictFiles = await detectionService.detectConflicts();
		if (conflictFiles.length > 0) {
			useConflictStore.getState().setConflicts(conflictFiles);
		}

		return conflictFiles;
	} catch (error) {
		console.error("[ConflictDetection] Failed to detect conflicts:", error);
		return [];
	}
}
