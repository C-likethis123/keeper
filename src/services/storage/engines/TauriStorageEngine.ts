import type { Note } from "@/services/notes/types";
import { parseFrontmatter, stringifyFrontmatter } from "@/services/notes/frontmatter";
import { getTauriInvoke } from "@/services/storage/runtime";
import type { NoteFileEntry, StorageEngine, StorageInitializeResult } from "@/services/storage/engines/StorageEngine";
import type { NoteIndexListResult, NoteIndexPersistenceItem } from "@/services/storage/types";

function tauriInvoke() {
	const invoke = getTauriInvoke();
	if (!invoke) {
		throw new Error("Tauri invoke is unavailable in this runtime");
	}
	return invoke;
}

export class TauriStorageEngine implements StorageEngine {
	async initialize(): Promise<StorageInitializeResult> {
		return tauriInvoke()<StorageInitializeResult>("storage_initialize");
	}

	async loadNote(id: string): Promise<Note | null> {
		const markdown = await tauriInvoke()<string | null>("read_note", { id });
		if (!markdown) return null;
		const parsed = parseFrontmatter(markdown);
		const mtime = await this.statNote(id);
		return {
			id,
			title: parsed.title,
			content: parsed.content,
			isPinned: parsed.isPinned,
			lastUpdated: mtime ?? 0,
		};
	}

	async saveNote(note: Note): Promise<Note> {
		const updatedAt = await tauriInvoke()<number>("write_note", {
			input: { id: note.id, content: stringifyFrontmatter(note) },
		});
		return {
			...note,
			lastUpdated: updatedAt || note.lastUpdated,
		};
	}

	async deleteNote(id: string): Promise<boolean> {
		return tauriInvoke()<boolean>("delete_note", { id });
	}

	async listNoteFiles(): Promise<NoteFileEntry[]> {
		return tauriInvoke()<NoteFileEntry[]>("list_note_files");
	}

	async statNote(id: string): Promise<number | null> {
		return tauriInvoke()<number | null>("stat_note", { id });
	}

	async indexUpsert(item: NoteIndexPersistenceItem): Promise<void> {
		await tauriInvoke()("index_upsert", {
			input: {
				noteId: item.noteId,
				title: item.title ?? "",
				summary: item.summary,
				isPinned: item.isPinned,
				updatedAt: item.updatedAt,
			},
		});
	}

	async indexDelete(noteId: string): Promise<void> {
		await tauriInvoke()("index_delete", { noteId });
	}

	async indexList(
		query: string,
		limit: number,
		offset?: number,
	): Promise<NoteIndexListResult> {
		return tauriInvoke()<NoteIndexListResult>("index_list", {
			input: {
				query,
				limit,
				offset,
			},
		});
	}

	async indexRebuildFromDisk(): Promise<{ noteCount: number }> {
		return tauriInvoke()<{ noteCount: number }>("index_rebuild_from_disk");
	}
}
