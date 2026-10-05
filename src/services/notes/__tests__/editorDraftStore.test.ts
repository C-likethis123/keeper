import { vi } from "vitest";
import {
	clearEditorDraft,
	getEditorDraftKey,
	readEditorDraft,
	writeEditorDraft,
} from "../editorDraftStore";

describe("editorDraftStore", () => {
	const storage = new Map<string, string>();
	const localStorageMock = {
		getItem: vi.fn((key: string) => storage.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			storage.set(key, value);
		}),
		removeItem: vi.fn((key: string) => {
			storage.delete(key);
		}),
	};

	beforeEach(() => {
		storage.clear();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: localStorageMock,
		});
		vi.spyOn(Date, "now").mockReturnValue(100);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		storage.clear();
	});

	it("removes drafts written before the persisted snapshot", () => {
		writeEditorDraft("note-1", "old body");

		clearEditorDraft("note-1", "new body", 101);

		expect(readEditorDraft("note-1")).toBeNull();
	});

	it("keeps newer drafts written while a save is in flight", () => {
		writeEditorDraft("note-1", "newer unsaved body");

		clearEditorDraft("note-1", "saved body", 99);

		expect(readEditorDraft("note-1")).toBe("newer unsaved body");
	});

	it("reads and clears legacy plain markdown drafts", () => {
		window.localStorage.setItem(getEditorDraftKey("note-1"), "legacy body");

		expect(readEditorDraft("note-1")).toBe("legacy body");

		clearEditorDraft("note-1", "saved body", 1);

		expect(readEditorDraft("note-1")).toBeNull();
	});
});
