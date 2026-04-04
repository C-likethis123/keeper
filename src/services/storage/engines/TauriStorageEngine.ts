import type { NotesIndexRebuildMetrics } from "@/services/notes/notesIndexDb";
import type { Note, NoteSaveInput } from "@/services/notes/types";
import type {
	NoteFileEntry,
	StorageEngine,
	StorageInitializeResult,
} from "@/services/storage/engines/StorageEngine";
import { getTauriInvoke } from "@/services/storage/runtime";
import type {
	NoteIndexListResult,
	NoteIndexPersistenceItem,
	NoteIndexQueryFilters,
} from "@/services/storage/types";

type ReadEntryResult = {
	id: string;
	title: string;
	content: string;
	isPinned: boolean;
	lastUpdated: number;
	noteType: Note["noteType"];
	status: Note["status"];
	createdAt: Note["createdAt"];
	completedAt: Note["completedAt"];
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

	async resetAllData(): Promise<void> {
		await this.invoke("storage_reset_all_data");
	}

	async loadNote(id: string): Promise<Note | null> {
		return this.invoke<ReadEntryResult | null>("read_note", { id });
	}

	async saveNote(note: NoteSaveInput): Promise<Note> {
		const updatedAt = await this.invoke<number>("write_note", {
			input: {
				id: note.id,
				title: note.title,
				content: note.content,
				isPinned: note.noteType === "template" ? false : note.isPinned,
				noteType: note.noteType,
				status: note.status,
				createdAt: note.createdAt,
				completedAt: note.completedAt,
			},
		});
		return {
			...note,
			isPinned: note.noteType === "template" ? false : note.isPinned,
			lastUpdated: updatedAt || Date.now(),
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
				noteType: item.noteType,
				status: item.status,
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
		filters?: NoteIndexQueryFilters,
	): Promise<NoteIndexListResult> {
		const tauriFilters =
			filters === undefined
				? undefined
				: {
						noteType:
							filters.noteTypes && filters.noteTypes.length > 0
								? filters.noteTypes[0]
								: undefined,
						status: filters.status,
					};

		return this.invoke<NoteIndexListResult>("index_list", {
			input: {
				query,
				limit,
				offset,
				filters: tauriFilters,
			},
		});
	}

	async indexRebuildFromDisk(): Promise<NotesIndexRebuildMetrics> {
		return this.invoke<NotesIndexRebuildMetrics>("index_rebuild_from_disk");
	}
}
