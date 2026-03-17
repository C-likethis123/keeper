import { GitService } from "@/services/git/gitService";
import { NotesIndexService, extractSummary } from "@/services/notes/notesIndex";
import { getStorageEngine } from "@/services/storage/storageEngine";
import { useStorageStore } from "@/stores/storageStore";
import type { ListNotesResult } from "./notesIndex";
import type { Note, NoteListFilters } from "./types";

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

	private static assertCanWrite(): void {
		const capabilities = useStorageStore.getState().capabilities;
		if (!capabilities.canWrite) {
			throw new Error(
				capabilities.reason ?? "Storage is unavailable in read-only mode",
			);
		}
	}

	static async loadNote(id: string): Promise<Note | null> {
		return getStorageEngine().loadNote(id);
	}

	static async saveNote(note: Note, isNewNote = false): Promise<Note> {
		NoteService.assertCanWrite();
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

		return saved;
	}

	static async deleteNote(id: string): Promise<boolean> {
		NoteService.assertCanWrite();
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
			return true;
		} catch (e) {
			console.warn("Failed to delete note:", e);
			return false;
		}
	}

	static async listNotesFallback(
		query: string,
		limit: number,
		offset?: number,
		filters?: NoteListFilters,
	): Promise<ListNotesResult> {
		const files = await getStorageEngine().listNoteFiles();
		const normalizedQuery = query.trim().toLowerCase();
		const filtered: Note[] = [];
		for (const file of files) {
			const loaded = await getStorageEngine().loadNote(file.id);
			if (!loaded) continue;
			const matches =
				normalizedQuery.length === 0 ||
				loaded.title.toLowerCase().includes(normalizedQuery) ||
				loaded.content.toLowerCase().includes(normalizedQuery);
			const matchesType =
				!filters?.noteType || loaded.noteType === filters.noteType;
			const matchesStatus =
				!filters?.status || loaded.status === filters.status;
			if (!matches || !matchesType || !matchesStatus) continue;
			filtered.push({
				...loaded,
				content: extractSummary(loaded.content),
			});
		}
		filtered.sort((a, b) => {
			if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
			return b.lastUpdated - a.lastUpdated;
		});
		const from = Math.max(0, offset ?? 0);
		const page = filtered.slice(from, from + limit);
		return {
			items: page.map((note) => ({
				noteId: note.id,
				title: note.title,
				summary: note.content,
				updatedAt: note.lastUpdated,
				isPinned: note.isPinned,
				noteType: note.noteType,
				status: note.status,
			})),
			cursor:
				from + limit < filtered.length
					? {
							offset: from + limit,
						}
					: undefined,
		};
	}
}
