import { NotesMetaService } from "@/services/notes/notesMetaService";
import { create } from "zustand";

type NotesMetaState = {
	pinned: Record<string, boolean>;
	togglePin: (id: string) => void;
	setPinned: (id: string, value: boolean) => Promise<void>;
	hydrate: () => Promise<void>;
};

export const useNotesMetaStore = create<NotesMetaState>()((set, get) => ({
	pinned: {},
	togglePin: (id) => {
		const next = !get().pinned[id];
		set((state) => ({
			pinned: { ...state.pinned, [id]: next },
		}));
		NotesMetaService.setPinned(id, next);
	},
	setPinned: async (id, value) => {
		set((state) => ({
			pinned: { ...state.pinned, [id]: value },
		}));
		await NotesMetaService.setPinned(id, value);
	},
	hydrate: async () => {
		const pinned = await NotesMetaService.getPinnedMap();
		set({ pinned });
	},
}));
