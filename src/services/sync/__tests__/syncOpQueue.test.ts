import {
	enqueueNoteCreate,
	enqueueNoteDelete,
	enqueueNoteUpdate,
	markSyncOpsPushed,
	readQueuedSyncOps,
} from "@/services/sync/syncOpQueue";
import type { Note } from "@/services/notes/types";

const mockAsyncStorage = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
	__esModule: true,
	default: {
		getItem: jest.fn((key: string) =>
			Promise.resolve(mockAsyncStorage.get(key) ?? null),
		),
		setItem: jest.fn((key: string, value: string) => {
			mockAsyncStorage.set(key, value);
			return Promise.resolve();
		}),
	},
}));

function makeNote(overrides: Partial<Note> = {}): Note {
	return {
		id: "note-1",
		title: "Inbox",
		content: "# Inbox",
		lastUpdated: Date.parse("2026-07-11T10:00:00Z"),
		isPinned: false,
		noteType: "note",
		status: null,
		createdAt: Date.parse("2026-07-11T09:00:00Z"),
		completedAt: null,
		attachment: null,
		attachedVideo: null,
		resourceUrl: null,
		documentPositions: null,
		modified: Date.parse("2026-07-11T10:00:00Z"),
		...overrides,
	};
}

describe("syncOpQueue", () => {
	beforeEach(() => {
		mockAsyncStorage.clear();
	});

	it("queues create, update, and delete operations in device sequence order", async () => {
		const created = await enqueueNoteCreate(makeNote());
		const updated = await enqueueNoteUpdate(
			makeNote({
				content: "# Inbox\n\nBody",
				lastUpdated: Date.parse("2026-07-11T10:01:00Z"),
			}),
		);
		const deleted = await enqueueNoteDelete("note-1");

		expect(created).toMatchObject({
			seq: 1,
			type: "note.create",
			noteId: "note-1",
			path: "note-1.md",
			title: "Inbox",
			createdAt: "2026-07-11T09:00:00.000Z",
		});
		expect(created.opId).toMatch(/^device-.+:1$/);
		expect(created.type).toBe("note.create");
		if (created.type === "note.create") {
			expect(created.markdown).toContain('title: "Inbox"');
		}
		expect(updated).toMatchObject({
			seq: 2,
			type: "note.update",
			noteId: "note-1",
			updatedAt: "2026-07-11T10:01:00.000Z",
		});
		expect(deleted).toMatchObject({
			seq: 3,
			type: "note.delete",
			noteId: "note-1",
		});

		expect(await readQueuedSyncOps()).toHaveLength(3);
	});

	it("removes accepted or duplicate operations after push", async () => {
		const created = await enqueueNoteCreate(makeNote());
		await enqueueNoteUpdate(makeNote({ content: "Body" }));

		await markSyncOpsPushed([created.opId]);

		const queued = await readQueuedSyncOps();
		expect(queued).toHaveLength(1);
		expect(queued[0]?.type).toBe("note.update");
	});
});
