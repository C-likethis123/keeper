/** Shared history shape. Storage and modal renderers stay platform-specific. */
export type NoteHistoryVersion<TNote> = {
	id: string;
	capturedAt: number;
	note: TNote;
};
