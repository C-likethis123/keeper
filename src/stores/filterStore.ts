import { create } from "zustand";
import type { NoteStatus, NoteType } from "@/services/notes/types";

interface FilterState {
	noteTypes: NoteType[];
	status?: NoteStatus;
	setNoteTypes: (types: NoteType[]) => void;
	setStatus: (status?: NoteStatus) => void;
	reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
	noteTypes: [],
	status: undefined,
	setNoteTypes: (noteTypes) => set({ noteTypes }),
	setStatus: (status) => set({ status }),
	reset: () => set({ noteTypes: [], status: undefined }),
}));
