import { GitService } from "@/services/git/gitService";
import { invalidateNoteQueryCache } from "@/services/notes/noteQueryCache";
import { NotesIndexService, extractSummary } from "@/services/notes/notesIndex";
import { storageEngine } from "@/services/storage/storageEngine";
import { useStorageStore } from "@/stores/storageStore";
import type { ListNotesResult } from "./notesIndex";
import type { Note, NoteListFilters, NoteSaveInput } from "./types";

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

	private static getGitPath(id: string): string {
		return `${id}.md`;
	}

	static async loadNote(id: string): Promise<Note | null> {
		return storageEngine.loadNote(id);
	}

	static async saveNote(note: NoteSaveInput, isNewNote = false): Promise<Note> {
		const id = note.id.trim();
		const pinnedState = !!note.isPinned;
		const title = (note.title ?? "").trim();
		const saved = await storageEngine.saveNote({
			...note,
			id,
			isPinned: pinnedState,
			title,
		});

		const summary = extractSummary(saved.content);
		await NotesIndexService.upsertNote({
			noteId: id,
			summary,
			title,
			isPinned: pinnedState,
			updatedAt: saved.lastUpdated,
			noteType: saved.noteType,
			status: saved.status ?? null,
		});

		await GitService.queueChangeAsync(
			NoteService.getGitPath(id),
			isNewNote ? "add" : "modify",
			{
				id,
				title,
				content: saved.content,
				isPinned: pinnedState,
				noteType: saved.noteType,
				status: saved.status ?? null,
				createdAt: saved.createdAt,
				completedAt: saved.completedAt,
				attachment: saved.attachment ?? null,
				attachedVideo: saved.attachedVideo ?? null,
			},
		);
		GitService.scheduleCommitBatch();
		invalidateNoteQueryCache();
		useStorageStore.getState().bumpContentVersion();

		return saved;
	}

	static async deleteNote(id: string): Promise<boolean> {
		try {
			const deleted = await storageEngine.deleteNote(id);
			if (!deleted) return false;
			try {
				await NotesIndexService.deleteNote(id);
			} catch (err) {
				console.warn("Failed to delete note from index:", err);
			}
			await GitService.queueChangeAsync(NoteService.getGitPath(id), "delete");
			GitService.scheduleCommitBatch();
			invalidateNoteQueryCache();
			useStorageStore.getState().bumpContentVersion();
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
		const files = await storageEngine.listNoteFiles();
		const normalizedQuery = query.trim().toLowerCase();
		const filtered: Note[] = [];
		for (const file of files) {
			const loaded = await storageEngine.loadNote(file.id);
			if (!loaded) continue;
			const matches =
				normalizedQuery.length === 0 ||
				loaded.title.toLowerCase().includes(normalizedQuery) ||
				loaded.content.toLowerCase().includes(normalizedQuery);
			const matchesType =
				!filters?.noteTypes ||
				filters.noteTypes.length === 0 ||
				filters.noteTypes.includes(loaded.noteType);
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
			cursor: from + limit < filtered.length ? from + limit : undefined,
		};
	}
}
