export type StorageBackend = "desktop-native" | "mobile-native";

export interface StorageCapabilities {
	backend: StorageBackend;
	canWrite: boolean;
	canSearch: boolean;
	reason?: string;
}

export interface NoteIndexPersistenceItem {
	noteId: string;
	summary: string;
	title: string;
	isPinned: boolean;
	updatedAt: number;
}

export interface NoteIndexListResult {
	items: NoteIndexPersistenceItem[];
	cursor?: { offset: number };
}
