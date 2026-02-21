import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { create } from "zustand";

interface NoteStore {
	notes: Record<string, Note>;
	loadNote: (id: string) => Promise<Note | null>;
	saveNote: (note: Note) => Promise<Note>;
	deleteNote: (id: string) => Promise<void>;
	clearCache: () => void;
}

// TODO: create a notes store AND a 'use notes'.
// Or maybe I need to replace that with a selector....
export const useNoteStore = create<NoteStore>((set, get) => ({
	notes: {},

	loadNote: async (id: string) => {
		const note = await NoteService.loadNote(id);
		if (note) {
			set({ notes: { ...get().notes, [id]: note } });
		}
		return note;
	},

	saveNote: async (note: Note) => {
		const saved = await NoteService.saveNote(note);
		set({ notes: { ...get().notes, [saved.id]: saved } });
		return saved;
	},

	deleteNote: async (id: string) => {
		const success = await NoteService.deleteNote(id);
		if (!success) throw new Error("Failed to delete note");
		const notes = { ...get().notes };
		delete notes[id];
		set({ notes });
	},

	clearCache: () => set({ notes: {} }),
}));
