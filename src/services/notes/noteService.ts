import { GitService } from "@/services/git/gitService";
import { invalidateNoteQueryCache } from "@/services/notes/noteQueryCache";
import { NotesIndexService, extractSummary } from "@/services/notes/notesIndex";
import { getStorageEngine } from "@/services/storage/storageEngine";
import type { Note } from "./types";

// Persists notes to the file system

// application level: notes crud

// persistence layer: notes DB

// there's two types of data: notes and note indices

export class NoteService {
	static instance = new NoteService();

	private constructor() {
		// desktop path setup is done by StorageInitializationService
		// mobile/web will lazily create notes root through expo-file-system on write.
	}

	static async loadNote(id: string): Promise<Note | null> {
		return getStorageEngine().loadNote(id);
	}

	static async saveNote(note: Note, isNewNote = false): Promise<Note> {
		const id = note.id.trim();
		const pinnedState = !!note.isPinned;
		const title = (note.title ?? "").trim();
		const saved = await getStorageEngine().saveNote({
			...note,
			id,
			isPinned: pinnedState,
			title,
		});
		const summary = extractSummary(note.content);

		await NotesIndexService.upsertNote({
			noteId: id,
			summary,
			title,
			isPinned: pinnedState,
			updatedAt: saved.lastUpdated,
			noteType: saved.noteType,
			status: saved.status,
		});

		GitService.queueChange(`${id}.md`, isNewNote ? "add" : "modify");
		GitService.scheduleCommitBatch();
		invalidateNoteQueryCache();

		return saved;
	}

	static async deleteNote(id: string): Promise<boolean> {
		try {
			const deleted = await getStorageEngine().deleteNote(id);
			if (!deleted) return false;
			try {
				await NotesIndexService.deleteNote(id);
			} catch (err) {
				console.warn("Failed to delete note from index:", err);
			}
			GitService.queueChange(`${id}.md`, "delete");
			GitService.scheduleCommitBatch();
			invalidateNoteQueryCache();
			return true;
		} catch (e) {
			console.warn("Failed to delete note:", e);
			return false;
		}
	}
}
