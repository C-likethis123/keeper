import type { Note } from "@/services/notes/types";
import { getTauriInvoke } from "@/services/storage/runtime";
import type { NoteFileEntry, StorageEngine, StorageInitializeResult } from "@/services/storage/engines/StorageEngine";
import type { NotesIndexRebuildMetrics } from "@/services/notes/notesIndexDb";
import type { NoteIndexListResult, NoteIndexPersistenceItem } from "@/services/storage/types";

type ReadNoteResult = {
	id: string;
	title: string;
	content: string;
	isPinned: boolean;
	lastUpdated: number;
};

type TauriInvoke = NonNullable<ReturnType<typeof getTauriInvoke>>;

export class TauriStorageEngine implements StorageEngine {
	private readonly invoke: TauriInvoke;

	constructor() {
		const invoke = getTauriInvoke();
		if (!invoke) {
			throw new Error("Tauri invoke is unavailable in this runtime");
		}
		this.invoke = invoke;
	}

	async initialize(): Promise<StorageInitializeResult> {
		return this.invoke<StorageInitializeResult>("storage_initialize");
	}

	async loadNote(id: string): Promise<Note | null> {
		return this.invoke<ReadNoteResult | null>("read_note", { id });
	}

	async saveNote(note: Note): Promise<Note> {
		const updatedAt = await this.invoke<number>("write_note", {
			input: {
				id: note.id,
				title: note.title,
				content: note.content,
				isPinned: note.isPinned,
			},
		});
		return {
			...note,
			lastUpdated: updatedAt || note.lastUpdated,
		};
	}

	async deleteNote(id: string): Promise<boolean> {
		return this.invoke<boolean>("delete_note", { id });
	}

	async listNoteFiles(): Promise<NoteFileEntry[]> {
		return this.invoke<NoteFileEntry[]>("list_note_files");
	}

	async statNote(id: string): Promise<number | null> {
		return this.invoke<number | null>("stat_note", { id });
	}

	async indexUpsert(item: NoteIndexPersistenceItem): Promise<void> {
		await this.invoke("index_upsert", {
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
		await this.invoke("index_delete", { noteId });
	}

	async indexList(
		query: string,
		limit: number,
		offset?: number,
	): Promise<NoteIndexListResult> {
		return this.invoke<NoteIndexListResult>("index_list", {
			input: {
				query,
				limit,
				offset,
			},
		});
	}

	async indexRebuildFromDisk(): Promise<NotesIndexRebuildMetrics> {
		return this.invoke<NotesIndexRebuildMetrics>("index_rebuild_from_disk");
	}
}
