import type {
	NoteListFilters,
	NoteStatus,
	NoteType,
} from "@/services/notes/types";

export type StorageBackend = "desktop-native" | "mobile-native";
export interface NoteIndexPersistenceItem {
	noteId: string;
	summary: string;
	title: string;
	isPinned: boolean;
	updatedAt: number;
	noteType: NoteType;
	status?: NoteStatus | null;
}

export interface NoteIndexListResult {
	items: NoteIndexPersistenceItem[];
	cursor?: number;
}

export type NoteIndexQueryFilters = NoteListFilters;
