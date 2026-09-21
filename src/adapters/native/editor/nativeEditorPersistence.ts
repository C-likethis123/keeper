import { persistEditorEntry } from "@/services/notes/editorEntryPersistence";
import { NoteService } from "@/services/notes/noteService";
import type { EditorPersistencePort } from "@/features/editor/session/editorSessionContract";

/** Native persistence adapter. Existing NoteEditorView can adopt it incrementally. */
export const nativeEditorPersistence: EditorPersistencePort = {
	save: async (draft, options) => persistEditorEntry({ ...draft, isNewEntry: options.isNew }),
	remove: async (noteId) => { await NoteService.deleteNote(noteId); },
};
