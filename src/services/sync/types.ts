export type NoteCreateSyncOperation = {
	opId: string;
	seq: number;
	type: "note.create";
	noteId: string;
	path: string;
	title: string;
	markdown: string;
	createdAt: string;
};

export type NoteUpdateSyncOperation = {
	opId: string;
	seq: number;
	type: "note.update";
	noteId: string;
	markdown: string;
	updatedAt: string;
};

export type NoteRenameSyncOperation = {
	opId: string;
	seq: number;
	type: "note.rename";
	noteId: string;
	path: string;
	title: string;
	updatedAt: string;
};

export type NoteDeleteSyncOperation = {
	opId: string;
	seq: number;
	type: "note.delete";
	noteId: string;
	deletedAt: string;
};

export type QueuedSyncOperation =
	| NoteCreateSyncOperation
	| NoteUpdateSyncOperation
	| NoteRenameSyncOperation
	| NoteDeleteSyncOperation;

export type SyncPushResponse = {
	accepted: string[];
	duplicates?: string[];
	cursor: number | null;
};

export type PulledSyncOperation = QueuedSyncOperation & {
	serverId: number;
	deviceId: string;
};

export type SyncPullResponse = {
	ops: PulledSyncOperation[];
	cursor: number;
};
