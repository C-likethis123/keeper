import { SyncConflictError } from "./errors.js";
import type {
	SyncOperation,
	NoteCreateOperation,
	SyncPullInput,
	SyncPullResult,
	SyncPushInput,
	SyncPushResult,
	SyncRepository,
	SeedNotesInput,
	SeedNotesResult,
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

	async pullOperations(input: SyncPullInput): Promise<SyncPullResult> {
		const scanned = this.operations
			.filter((stored) => stored.id > input.cursor)
			.sort((a, b) => a.id - b.id)
			.slice(0, input.limit);
		const cursor = scanned.at(-1)?.id ?? input.cursor;
		const ops = scanned
			.filter((stored) => stored.deviceId !== input.deviceId)
			.map((stored) => ({
				...stored.operation,
				serverId: stored.id,
				deviceId: stored.deviceId,
			}));

		return { ops, cursor };
	}

	async hasNotes(): Promise<boolean> {
		return [...this.notes.values()].some((note) => !note.deletedAt);
	}

	async seedNotes(input: SeedNotesInput): Promise<SeedNotesResult> {
		const existingSeqs = this.operations
			.filter((stored) => stored.deviceId === input.deviceId)
			.map((stored) => stored.seq);
		let nextSeq = Math.max(0, ...existingSeqs) + 1;
		const operations: NoteCreateOperation[] = input.notes.map((note) => ({
			opId: `github-seed:${note.sourceSha}:${note.path}`,
			seq: nextSeq++,
			type: "note.create",
			noteId: note.noteId,
			path: note.path,
			title: note.title,
			markdown: note.markdown,
			createdAt: note.timestamp,
		}));
		const accepted: string[] = [];
		const duplicates: string[] = [];
		let cursor: number | null = null;

		for (const operation of operations) {
			const existingByOp = this.operations.find(
				(stored) => stored.operation.opId === operation.opId,
			);
			if (existingByOp) {
				duplicates.push(operation.opId);
				cursor = Math.max(cursor ?? 0, existingByOp.id);
				continue;
			}

			const id = this.nextId++;
			this.operations.push({
				id,
				deviceId: input.deviceId,
				seq: operation.seq,
				operation,
			});
			this.upsertSeedNote(operation);
			accepted.push(operation.opId);
			cursor = id;
		}

		return { accepted, duplicates, cursor, noteCount: input.notes.length };
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
					this.notes.set(operation.noteId, {
						id: operation.noteId,
						path: `${operation.noteId}.md`,
						title: extractTitle(operation.markdown),
						markdown: operation.markdown,
						createdAt: operation.updatedAt,
						updatedAt: operation.updatedAt,
						deletedAt: null,
						version: 1,
					});
					return;
				}
				this.notes.set(operation.noteId, {
					...note,
					title: extractTitle(operation.markdown) || note.title,
					markdown: operation.markdown,
					updatedAt: operation.updatedAt,
					version: note.version + 1,
				});
				return;
			}
			case "note.rename": {
				const note = this.notes.get(operation.noteId);
				if (!note || note.deletedAt) {
					return;
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
					return;
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

	private upsertSeedNote(operation: NoteCreateOperation) {
		const existing = this.notes.get(operation.noteId);
		this.notes.set(operation.noteId, {
			id: operation.noteId,
			path: operation.path,
			title: operation.title,
			markdown: operation.markdown,
			createdAt: existing?.createdAt ?? operation.createdAt,
			updatedAt: operation.createdAt,
			deletedAt: null,
			version: (existing?.version ?? 0) + 1,
		});
	}
}

function extractTitle(markdown: string): string {
	const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
	if (!match) return "";
	for (const rawLine of match[1].split(/\r?\n/)) {
		const separator = rawLine.indexOf(":");
		if (separator < 0) continue;
		const key = rawLine.slice(0, separator).trim();
		if (key !== "title") continue;
		const value = rawLine.slice(separator + 1).trim();
		if (value.startsWith('"') && value.endsWith('"')) {
			try {
				return JSON.parse(value) as string;
			} catch {
				return value.slice(1, -1);
			}
		}
		return value;
	}
	return "";
}
