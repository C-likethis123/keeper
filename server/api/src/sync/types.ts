export type NoteCreateOperation = {
	opId: string;
	seq: number;
	type: "note.create";
	noteId: string;
	path: string;
	title: string;
	markdown: string;
	createdAt: string;
};

export type NoteUpdateOperation = {
	opId: string;
	seq: number;
	type: "note.update";
	noteId: string;
	markdown: string;
	updatedAt: string;
};

export type NoteRenameOperation = {
	opId: string;
	seq: number;
	type: "note.rename";
	noteId: string;
	path: string;
	title: string;
	updatedAt: string;
};

export type NoteDeleteOperation = {
	opId: string;
	seq: number;
	type: "note.delete";
	noteId: string;
	deletedAt: string;
};

export type SyncOperation =
	| NoteCreateOperation
	| NoteUpdateOperation
	| NoteRenameOperation
	| NoteDeleteOperation;

export type SyncPushInput = {
	deviceId: string;
	deviceName?: string;
	ops: SyncOperation[];
};

export type SyncPushResult = {
	accepted: string[];
	duplicates: string[];
	cursor: number | null;
};

export type PulledSyncOperation = SyncOperation & {
	serverId: number;
	deviceId: string;
};

export type SyncPullInput = {
	deviceId?: string;
	cursor: number;
	limit: number;
};

export type SyncPullResult = {
	ops: PulledSyncOperation[];
	cursor: number;
};

export type SeedNoteInput = {
	noteId: string;
	path: string;
	title: string;
	markdown: string;
	sourceSha: string;
	timestamp: string;
};

export type SeedNotesInput = {
	deviceId: string;
	notes: SeedNoteInput[];
};

export type SeedNotesResult = SyncPushResult & {
	noteCount: number;
};

export type SyncRepository = {
	pushOperations(input: SyncPushInput): Promise<SyncPushResult>;
	pullOperations(input: SyncPullInput): Promise<SyncPullResult>;
	hasNotes(): Promise<boolean>;
	seedNotes(input: SeedNotesInput): Promise<SeedNotesResult>;
};
