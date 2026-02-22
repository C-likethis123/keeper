import { GitService } from "@/services/git/gitService";
import { NotesIndexService, extractSummary } from "@/services/notes/notesIndex";
import { Directory, File } from "expo-file-system";
import matter from "gray-matter";
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
				const { data, content } = matter(await file.text());
				const mtime = file.modificationTime ?? 0;
				return {
					id,
					title: data.title,
					content,
					lastUpdated: mtime,
					isPinned: data.pinned,
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
		await file.write(
			matter.stringify(note.content, {
				frontmatter: {
					pinned: note.isPinned,
					title: note.title,
					id: note.id,
				},
			}),
		);

		const pinnedState = !!note.isPinned;
		const title = note.title.trim();
		const summary = extractSummary(note.content);

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
}
