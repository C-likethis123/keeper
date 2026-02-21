import { GitService } from "@/services/git/gitService";
import { NotesIndexService, extractSummary } from "@/services/notes/notesIndex";
import { NotesMetaService } from "@/services/notes/notesMetaService";
import { Directory, File } from "expo-file-system";
import { NOTES_ROOT } from "./Notes";
import type { Note } from "./types";

export class NoteService {
	static instance = new NoteService();

	private constructor() {
		this.ensureNotesRoot();
	}

	private async ensureNotesRoot(): Promise<void> {
		try {
			const dir = new Directory(NOTES_ROOT);
			if (!dir.exists) {
				dir.create({ intermediates: true });
			}
		} catch (e) {
			console.warn("Failed to ensure notes root:", e);
		}
	}

	static async loadNote(id: string): Promise<Note | null> {
		try {
			const file = new File(NOTES_ROOT, `${id}.md`);
			if (file.exists) {
				const content = await file.text();
				const mtime = file.modificationTime ?? 0;
				const [isPinned, title] = await Promise.all([
					NotesMetaService.getPinned(id),
					NotesMetaService.getTitle(id),
				]);
				return {
					id,
					title,
					content,
					lastUpdated: mtime,
					isPinned,
				};
			}
		} catch (localError) {
			console.warn("Failed to load note:", localError);
			return null;
		}
		return null;
	}

	static async saveNote(note: Note): Promise<Note> {
		const id = note.id;
		const file = new File(NOTES_ROOT, `${id}.md`);
		await file.write(note.content);

		const pinnedState = !!note.isPinned;
		const title = note.title.trim();
		const summary = extractSummary(note.content);

		await NotesMetaService.setPinned(id, pinnedState);
		await NotesMetaService.setTitle(id, title);
		await NotesIndexService.upsertNote({
			noteId: id,
			summary,
			title,
			isPinned: pinnedState,
			updatedAt: note.lastUpdated,
		});

		GitService.queueChange(`${id}.md`, !note.id ? "add" : "modify");
		void GitService.commitBatch();

		return {
			id,
			title,
			content: note.content,
			lastUpdated: note.lastUpdated,
			isPinned: pinnedState,
		};
	}

	static async deleteNote(id: string): Promise<boolean> {
		try {
			const file = new File(NOTES_ROOT, `${id}.md`);
			if (!file.exists) return false;

			file.delete();
			try {
				await NotesIndexService.deleteNote(id);
			} catch (err) {
				console.warn("Failed to delete note from index:", err);
			}
			GitService.queueChange(`${id}.md`, "delete");
			void GitService.commitBatch();
			return true;
		} catch (e) {
			console.warn("Failed to delete note:", e);
			return false;
		}
	}

	static async scanNotes(folderPath: string): Promise<Note[]> {
		const metadata: Note[] = [];
		try {
			const dir = new Directory(folderPath);
			const entries = dir.list();

			for (const entry of entries) {
				if (entry instanceof File && entry.name.endsWith(".md")) {
					const noteId = entry.name.replace(/\.md$/, "");
					const indexItem = await NotesIndexService.instance.getNote(noteId);
					const content = await entry.text();
					const [storedTitle] = await Promise.all([
						NotesMetaService.getTitle(noteId),
					]);
					metadata.push({
						id: noteId,
						title: storedTitle,
						content,
						lastUpdated: entry.modificationTime ?? 0,
						isPinned: indexItem?.isPinned ?? false,
					});
				}
			}
		} catch (e) {
			console.warn("Failed to scan notes:", e);
		}
		return metadata;
	}
}
