import type { GitConflictFile } from "@/services/git/engines/GitEngine";
import { create } from "zustand";

export interface ConflictRecord {
	file: GitConflictFile;
	resolved: boolean;
	resolvedAt?: number;
	resolutionStrategy?: string;
}

interface ConflictState {
	conflicts: ConflictRecord[];
	lastDetectedAt: number | null;
	isResolving: boolean;
	isShowingModal: boolean;

	// Actions
	setConflicts: (files: GitConflictFile[]) => void;
	markResolved: (path: string, strategy: string) => void;
	markAllResolved: (strategy: string) => void;
	clearConflicts: () => void;
	setResolving: (isResolving: boolean) => void;
	showConflictModal: () => void;
	hideConflictModal: () => void;
	hasUnresolvedConflicts: () => boolean;
	getUnresolvedCount: () => number;
}

export const useConflictStore = create<ConflictState>((set, get) => ({
	conflicts: [],
	lastDetectedAt: null,
	isResolving: false,
	isShowingModal: false,

	setConflicts: (files: GitConflictFile[]) =>
		set({
			conflicts: files.map((file) => ({
				file,
				resolved: false,
			})),
			lastDetectedAt: Date.now(),
		}),

	markResolved: (path: string, strategy: string) =>
		set((state) => ({
			conflicts: state.conflicts.map((c) =>
				c.file.path === path
					? { ...c, resolved: true, resolvedAt: Date.now(), resolutionStrategy: strategy }
					: c,
			),
		})),

	markAllResolved: (strategy: string) =>
		set((state) => ({
			conflicts: state.conflicts.map((c) => ({
				...c,
				resolved: true,
				resolvedAt: Date.now(),
				resolutionStrategy: strategy,
			})),
		})),

	clearConflicts: () =>
		set({
			conflicts: [],
			lastDetectedAt: null,
		}),

	setResolving: (isResolving: boolean) => set({ isResolving }),

	showConflictModal: () => set({ isShowingModal: true }),
	hideConflictModal: () => set({ isShowingModal: false }),

	hasUnresolvedConflicts: () => {
		const { conflicts } = get();
		return conflicts.some((c) => !c.resolved);
	},

	getUnresolvedCount: () => {
		const { conflicts } = get();
		return conflicts.filter((c) => !c.resolved).length;
	},
}));
