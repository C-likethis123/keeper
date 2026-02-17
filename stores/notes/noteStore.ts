import { NoteService } from "@/services/notes/noteService";
import { Note, NoteToSave } from "@/services/notes/types";
import { create } from "zustand";

interface NoteStore {
  notes: Record<string, Note>;
  loadNote: (filePath: string) => Promise<Note | null>;
  saveNote: (note: NoteToSave) => Promise<void>;
  deleteNote: (filePath: string) => Promise<void>;
  clearCache: () => void;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: {},

  loadNote: async (filePath: string) => {
    const note = await NoteService.loadNote(filePath);
    if (note) {
      set({ notes: { ...get().notes, [filePath]: note } });
    }
    return note;
  },

  saveNote: async (note: NoteToSave) => {
    const saved = await NoteService.saveNote(note);
    set({ notes: { ...get().notes, [saved.filePath]: saved } });
  },

  deleteNote: async (filePath: string) => {
    const success = await NoteService.deleteNote(filePath);
    if (!success) throw new Error("Failed to delete note");
    const notes = { ...get().notes };
    delete notes[filePath];
    set({ notes });
  },

  clearCache: () => set({ notes: {} }),
}));
