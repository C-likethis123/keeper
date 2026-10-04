import type { Note } from "@/services/notes/types";
import type {
	NoteStatus,
	NoteType,
} from "@/services/notes/types";

export interface NoteIndexItem {
	noteId: string;
	summary: string;
	title: string;
	isPinned: boolean;
	updatedAt: number;
	noteType: NoteType;
	status?: NoteStatus | null;
}

export interface ListNotesResult {
	items: NoteIndexItem[];
	cursor?: number;
}

export interface NotesIndexRebuildMetrics {
	noteCount: number;
	totalMs?: number;
}

export interface NoteIndexRow {
	id: string;
	title: string;
	summary: string;
	is_pinned: number;
	updated_at: number;
	note_type: NoteType | null;
	status: NoteStatus | null;
}

export interface NoteSection {
	id: string;
	title: string;
	notes: Note[];
	memberNoteIds?: string[];
	clusterId?: string;
	superClusterId?: string;
	clusterActions?: {
		onRename: () => void;
		onAddNote: () => void;
		onDelete: () => void;
		onRemoveNote: (noteId: string) => void;
	};
}
