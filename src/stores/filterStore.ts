import type { NoteStatus, NoteType } from "@/services/notes/types";
import { create } from "zustand";

interface FilterState {
	noteTypes: NoteType[];
	status?: NoteStatus;
	hideDone: boolean;
	isPanelOpen: boolean;
	setNoteTypes: (types: NoteType[]) => void;
	setStatus: (status?: NoteStatus) => void;
	setHideDone: (hideDone: boolean) => void;
	openPanel: () => void;
	closePanel: () => void;
	reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
	noteTypes: [],
	status: undefined,
	hideDone: true,
	isPanelOpen: false,
	setNoteTypes: (noteTypes) => set({ noteTypes }),
	setStatus: (status) => set({ status }),
	setHideDone: (hideDone) => set({ hideDone }),
	openPanel: () => set({ isPanelOpen: true }),
	closePanel: () => set({ isPanelOpen: false }),
	reset: () =>
		set({
			noteTypes: [],
			status: undefined,
			hideDone: true,
			isPanelOpen: false,
		}),
}));
