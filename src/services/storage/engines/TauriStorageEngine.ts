import type { NotesIndexRebuildMetrics } from "@/services/notes/notesIndexDb";
import type { Note, NoteTemplate } from "@/services/notes/types";
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
};

type WriteTemplateInput = {
	id: string;
	title: string;
	content: string;
	noteType: NoteTemplate["noteType"];
	status: NoteTemplate["status"];
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

	async saveNote(note: Note): Promise<Note> {
		const updatedAt = await this.invoke<number>("write_note", {
			input: {
				id: note.id,
				title: note.title,
				content: note.content,
				isPinned: note.isPinned,
				noteType: note.noteType,
				status: note.status,
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

	async loadTemplate(id: string): Promise<NoteTemplate | null> {
		const template = await this.invoke<ReadEntryResult | null>(
			"read_template",
			{
				id,
			},
		);
		if (!template) {
			return null;
		}
		return {
			id: template.id,
			title: template.title,
			content: template.content,
			lastUpdated: template.lastUpdated,
			noteType: "template",
			status: undefined,
		};
	}

	async saveTemplate(template: NoteTemplate): Promise<NoteTemplate> {
		const input: WriteTemplateInput = {
			id: template.id,
			title: template.title,
			content: template.content,
			noteType: "template",
			status: undefined,
		};
		const updatedAt = await this.invoke<number>("write_template", {
			input,
		});
		return {
			...template,
			noteType: "template",
			status: undefined,
			lastUpdated: updatedAt || template.lastUpdated,
		};
	}

	async deleteTemplate(id: string): Promise<boolean> {
		return this.invoke<boolean>("delete_template", { id });
	}

	async listTemplates(): Promise<NoteTemplate[]> {
		const templates = await this.invoke<ReadEntryResult[]>("list_templates");
		return templates.map((template) => ({
			id: template.id,
			title: template.title,
			content: template.content,
			lastUpdated: template.lastUpdated,
			noteType: "template",
			status: undefined,
		}));
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
		return this.invoke<NoteIndexListResult>("index_list", {
			input: {
				query,
				limit,
				offset,
				filters,
			},
		});
	}

	async indexRebuildFromDisk(): Promise<NotesIndexRebuildMetrics> {
		return this.invoke<NotesIndexRebuildMetrics>("index_rebuild_from_disk");
	}
}
