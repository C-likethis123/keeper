import { getTauriInvoke } from "@/services/storage/runtime";
import type {
	ListNotesResult,
	NoteIndexItem,
	NoteIndexRow,
	NotesIndexRebuildMetrics,
	NotesIndexSyncMetrics,
} from "./indexDb/types";
import type { NoteListFilters } from "./types";

export type {
	ListNotesResult,
	NoteIndexItem,
	NotesIndexRebuildMetrics,
	NotesIndexSyncMetrics,
};

type TauriIndexItem = {
	noteId: string;
	title: string;
	summary: string;
	isPinned: boolean;
	updatedAt: number;
	noteType: string;
	status: string | null;
};

function invoke<T>(
	command: string,
	args?: Record<string, unknown>,
): Promise<T> {
	const fn = getTauriInvoke();
	if (!fn) throw new Error("Tauri invoke unavailable");
	return fn<T>(command, args);
}

export async function notesIndexDbHasRows(): Promise<boolean> {
	const result = await invoke<{ items: unknown[]; cursor?: number }>(
		"index_list",
		{ input: { query: "", limit: 1 } },
	);
	return result.items.length > 0;
}

export async function notesIndexDbUpsert(_item: NoteIndexItem): Promise<void> {
	// On desktop, upserts go through TauriStorageEngine.indexUpsert — this path is unreachable.
}

export async function notesIndexDbDelete(_noteId: string): Promise<void> {
	// On desktop, deletes go through TauriStorageEngine.indexDelete — this path is unreachable.
}

export async function notesIndexDbListAll(
	query: string,
	limit: number,
	offset?: number,
	_filters?: NoteListFilters,
): Promise<ListNotesResult> {
	const result = await invoke<{ items: TauriIndexItem[]; cursor?: number }>(
		"index_list",
		{ input: { query, limit, offset } },
	);
	return {
		items: result.items.map((r) => ({
			noteId: r.noteId,
			title: r.title,
			summary: r.summary,
			isPinned: r.isPinned,
			updatedAt: r.updatedAt,
			noteType: r.noteType as NoteIndexItem["noteType"],
			status: r.status as NoteIndexItem["status"],
		})),
		cursor: result.cursor,
	};
}

export async function notesIndexDbGetBacklinks(
	noteId: string,
): Promise<string[]> {
	return invoke<string[]>("wiki_links_get_backlinks", { noteId });
}

export async function notesIndexDbGetOutgoingLinks(
	noteId: string,
): Promise<string[]> {
	return invoke<string[]>("wiki_links_get_outgoing", { noteId });
}

export async function notesIndexDbGetTransitiveBacklinks(
	_noteId: string,
	_maxDepth = 3,
): Promise<{ noteId: string; depth: number }[]> {
	// No Tauri equivalent — return empty on desktop.
	return [];
}

export async function notesIndexDbGetOrphanedNotes(): Promise<string[]> {
	return invoke<string[]>("wiki_links_get_orphaned_notes");
}

export async function notesIndexDbGetRecentlyEditedNotes(
	limit = 10,
	daysBack = 7,
): Promise<NoteIndexRow[]> {
	const rows = await invoke<TauriIndexItem[]>(
		"wiki_links_get_recently_edited",
		{
			limit,
			daysBack,
		},
	);
	return rows.map((r) => ({
		id: r.noteId,
		title: r.title,
		summary: r.summary,
		is_pinned: r.isPinned ? 1 : 0,
		updated_at: r.updatedAt,
		note_type: r.noteType as NoteIndexRow["note_type"],
		status: r.status as NoteIndexRow["status"],
	}));
}
