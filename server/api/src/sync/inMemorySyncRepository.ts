import { SyncConflictError } from "./errors.js";
import type {
	SyncOperation,
	SyncPushInput,
	SyncPushResult,
	SyncRepository,
} from "./types.js";

type NoteRow = {
	id: string;
	path: string;
	title: string;
	markdown: string;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
	version: number;
};

type StoredOperation = {
	id: number;
	deviceId: string;
	seq: number;
	operation: SyncOperation;
};

export class InMemorySyncRepository implements SyncRepository {
	readonly notes = new Map<string, NoteRow>();
	readonly operations: StoredOperation[] = [];
	private nextId = 1;

	async pushOperations(input: SyncPushInput): Promise<SyncPushResult> {
		const accepted: string[] = [];
		const duplicates: string[] = [];
		let cursor: number | null = null;

		for (const operation of [...input.ops].sort((a, b) => a.seq - b.seq)) {
			const existingByOp = this.operations.find(
				(stored) => stored.operation.opId === operation.opId,
			);

			if (existingByOp) {
				duplicates.push(operation.opId);
				cursor = Math.max(cursor ?? 0, existingByOp.id);
				continue;
			}

			const existingBySeq = this.operations.find(
				(stored) =>
					stored.deviceId === input.deviceId && stored.seq === operation.seq,
			);

			if (existingBySeq) {
				throw new SyncConflictError(
					`device sequence already used by ${existingBySeq.operation.opId}`,
				);
			}

			const id = this.nextId++;
			this.operations.push({
				id,
				deviceId: input.deviceId,
				seq: operation.seq,
				operation,
			});
			this.applyOperation(operation);
			accepted.push(operation.opId);
			cursor = id;
		}

		return {
			accepted,
			duplicates,
			cursor,
		};
	}

	private applyOperation(operation: SyncOperation): void {
		switch (operation.type) {
			case "note.create":
				if ([...this.notes.values()].some((note) => note.path === operation.path)) {
					throw new SyncConflictError("operation conflicts with existing note");
				}
				if (this.notes.has(operation.noteId)) {
					throw new SyncConflictError("operation conflicts with existing note");
				}
				this.notes.set(operation.noteId, {
					id: operation.noteId,
					path: operation.path,
					title: operation.title,
					markdown: operation.markdown,
					createdAt: operation.createdAt,
					updatedAt: operation.createdAt,
					deletedAt: null,
					version: (this.notes.get(operation.noteId)?.version ?? 0) + 1,
				});
				return;
			case "note.update": {
				const note = this.notes.get(operation.noteId);
				if (!note || note.deletedAt) {
					throw new SyncConflictError("note does not exist or is deleted");
				}
				this.notes.set(operation.noteId, {
					...note,
					markdown: operation.markdown,
					updatedAt: operation.updatedAt,
					version: note.version + 1,
				});
				return;
			}
			case "note.rename": {
				const note = this.notes.get(operation.noteId);
				if (!note || note.deletedAt) {
					throw new SyncConflictError("note does not exist or is deleted");
				}
				if (
					[...this.notes.values()].some(
						(existing) =>
							existing.id !== operation.noteId && existing.path === operation.path,
					)
				) {
					throw new SyncConflictError("operation conflicts with existing note");
				}
				this.notes.set(operation.noteId, {
					...note,
					path: operation.path,
					title: operation.title,
					updatedAt: operation.updatedAt,
					version: note.version + 1,
				});
				return;
			}
			case "note.delete": {
				const note = this.notes.get(operation.noteId);
				if (!note || note.deletedAt) {
					throw new SyncConflictError("note does not exist or is deleted");
				}
				this.notes.set(operation.noteId, {
					...note,
					deletedAt: operation.deletedAt,
					updatedAt: operation.deletedAt,
					version: note.version + 1,
				});
				return;
			}
		}
	}
}
