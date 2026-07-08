import * as Y from "yjs";
import {
	compactCrdtUpdates,
	loadCrdtEditorSnapshot,
	loadCrdtDoc,
	persistCrdtUpdate,
	readCrdtFrontmatter,
	readCrdtMarkdown,
	saveMarkdownToCrdt,
} from "../crdtNoteService";

const mockFiles = new Map<string, Uint8Array>();
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

jest.mock("@/services/storage/storageEngine", () => ({
	storageEngine: {
		readFileBytes: jest.fn((path: string) =>
			Promise.resolve(mockFiles.get(path) ?? null),
		),
		writeFileBytes: jest.fn((path: string, data: Uint8Array) => {
			mockFiles.set(path, data);
			return Promise.resolve();
		}),
		listFilesRecursive: jest.fn((dir: string) =>
			Promise.resolve(
				[...mockFiles.keys()].filter(
					(path) => path === dir || path.startsWith(`${dir}/`),
				),
			),
		),
		deleteDirectory: jest.fn((dir: string) => {
			for (const path of [...mockFiles.keys()]) {
				if (path === dir || path.startsWith(`${dir}/`)) {
					mockFiles.delete(path);
				}
			}
			return Promise.resolve();
		}),
	},
}));

describe("crdtNoteService", () => {
	beforeEach(() => {
		mockFiles.clear();
		mockAsyncStorage.clear();
		mockAsyncStorage.set("keeper:crdt:client-id", "client-a");
	});

	it("bootstraps markdown once and saves later edits as Yjs updates", async () => {
		await saveMarkdownToCrdt({
			id: "note-1",
			title: "Note",
			content: "Hello",
			isPinned: false,
			noteType: "note",
			status: null,
		});
		await saveMarkdownToCrdt({
			id: "note-1",
			title: "Note",
			content: "Hello world",
			isPinned: false,
			noteType: "note",
			status: null,
		});

		expect(await readCrdtMarkdown("note-1")).toBe("Hello world");
		expect([...mockFiles.keys()]).toHaveLength(2);
	});

	it("stores frontmatter metadata in a Y.Map", async () => {
		await saveMarkdownToCrdt({
			id: "note-1",
			title: "TODO: Ship release",
			content: "Body",
			isPinned: true,
			noteType: "todo",
			status: "open",
			createdAt: 1710000000000,
			completedAt: null,
			attachment: "_attachments/spec.pdf",
		});

		await expect(readCrdtFrontmatter("note-1")).resolves.toEqual(
			expect.objectContaining({
				attachment: "_attachments/spec.pdf",
				createdAt: 1710000000000,
				isPinned: true,
				noteType: "todo",
				status: "open",
				title: "TODO: Ship release",
			}),
		);
	});

	it("keeps Yjs updates idempotent when reloaded", async () => {
		await saveMarkdownToCrdt({
			id: "note-1",
			title: "Note",
			content: "Alpha",
			isPinned: false,
			noteType: "note",
			status: null,
		});
		const doc = await loadCrdtDoc("note-1");
		const update = Y.encodeStateAsUpdate(doc);

		Y.applyUpdate(doc, update);
		Y.applyUpdate(doc, update);

		expect(doc.getText("body").toString()).toBe("Alpha");
	});

	it("returns an editor snapshot for collaboration bootstrap", async () => {
		await saveMarkdownToCrdt({
			id: "note-1",
			title: "Note",
			content: "Alpha",
			isPinned: false,
			noteType: "note",
			status: null,
		});

		const snapshot = await loadCrdtEditorSnapshot("note-1");

		expect(snapshot?.markdown).toBe("Alpha");
		expect(snapshot?.update.length).toBeGreaterThan(0);
	});

	it("merges concurrent updates from two device docs", async () => {
		await saveMarkdownToCrdt({
			id: "note-1",
			title: "Note",
			content: "Alpha",
			isPinned: false,
			noteType: "note",
			status: null,
		});
		const deviceA = await loadCrdtDoc("note-1");
		const deviceB = await loadCrdtDoc("note-1");
		let updateA: Uint8Array | null = null;
		let updateB: Uint8Array | null = null;
		deviceA.on("update", (update: Uint8Array) => {
			updateA = update;
		});
		deviceB.on("update", (update: Uint8Array) => {
			updateB = update;
		});

		deviceA.getText("body").insert(0, "A ");
		deviceB.getText("body").insert(5, " B");
		mockAsyncStorage.set("keeper:crdt:client-id", "client-a");
		await persistCrdtUpdate("note-1", updateA ?? []);
		mockAsyncStorage.set("keeper:crdt:client-id", "client-b");
		await persistCrdtUpdate("note-1", updateB ?? []);

		const merged = await readCrdtMarkdown("note-1");

		expect(merged).toContain("A ");
		expect(merged).toContain("Alpha");
		expect(merged).toContain(" B");
	});

	it("compacts note updates with Y.mergeUpdates", async () => {
		await saveMarkdownToCrdt({
			id: "note-1",
			title: "Note",
			content: "One",
			isPinned: false,
			noteType: "note",
			status: null,
		});
		await saveMarkdownToCrdt({
			id: "note-1",
			title: "Note",
			content: "One two",
			isPinned: false,
			noteType: "note",
			status: null,
		});

		await expect(compactCrdtUpdates("note-1")).resolves.toBe(true);

		expect([...mockFiles.keys()]).toHaveLength(1);
		await expect(readCrdtMarkdown("note-1")).resolves.toBe("One two");
	});
});
