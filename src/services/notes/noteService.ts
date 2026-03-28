import { GitService } from "@/services/git/gitService";
import { invalidateNoteQueryCache } from "@/services/notes/noteQueryCache";
import { NotesIndexService, extractSummary } from "@/services/notes/notesIndex";
import { getTemplateRelativePath } from "@/services/notes/templatePaths";
import { getStorageEngine } from "@/services/storage/storageEngine";
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

	private static getGitPath(id: string, noteType: string): string {
		return noteType === "template" ? getTemplateRelativePath(id) : `${id}.md`;
	}

	static async loadNote(id: string): Promise<Note | null> {
		return getStorageEngine().loadNote(id);
	}

	static async saveNote(note: NoteSaveInput, isNewNote = false): Promise<Note> {
		const id = note.id.trim();
		const isTemplate = note.noteType === "template";
		const pinnedState = isTemplate ? false : !!note.isPinned;
		const title = (note.title ?? "").trim();
		const saved = await getStorageEngine().saveNote({
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

		GitService.queueChange(
			NoteService.getGitPath(id, note.noteType),
			isNewNote ? "add" : "modify",
		);
		GitService.scheduleCommitBatch();
		invalidateNoteQueryCache();

		return saved;
	}

	static async deleteNote(id: string, noteType?: string): Promise<boolean> {
		try {
			const deleted = await getStorageEngine().deleteNote(id);
			if (!deleted) return false;
			try {
				await NotesIndexService.deleteNote(id);
			} catch (err) {
				console.warn("Failed to delete note from index:", err);
			}
			GitService.queueChange(
				NoteService.getGitPath(id, noteType ?? "note"),
				"delete",
			);
			GitService.scheduleCommitBatch();
			invalidateNoteQueryCache();
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
