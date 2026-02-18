import { NotesMetaService } from "@/services/notes/notesMetaService";
import { create } from "zustand";

type NotesMetaState = {
	pinned: Record<string, boolean>;
	togglePin: (filePath: string) => void;
	setPinned: (filePath: string, value: boolean) => Promise<void>;
	hydrate: () => Promise<void>;
};

export const useNotesMetaStore = create<NotesMetaState>()((set, get) => ({
	pinned: {},
	togglePin: (filePath) => {
		const next = !get().pinned[filePath];
		set((state) => ({
			pinned: { ...state.pinned, [filePath]: next },
		}));
		NotesMetaService.setPinned(filePath, next);
	},
	setPinned: async (filePath, value) => {
		set((state) => ({
			pinned: { ...state.pinned, [filePath]: value },
		}));
		await NotesMetaService.setPinned(filePath, value);
	},
	hydrate: async () => {
		const pinned = await NotesMetaService.getPinnedMap();
		set({ pinned });
	},
}));
