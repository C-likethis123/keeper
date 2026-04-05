import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { useStorageStore } from "@/stores/storageStore";
import { renderHook, waitFor } from "@testing-library/react-native";
import { useLoadNote } from "../useLoadNote";

function makeNote(overrides: Partial<Note> = {}): Note {
	return {
		id: "note-1",
		title: "Draft note",
		content: "Body",
		lastUpdated: 1710000000000,
		isPinned: false,
		noteType: "note",
		status: null,
		...overrides,
	};
}

describe("useLoadNote", () => {
	beforeEach(() => {
		jest.restoreAllMocks();
		useStorageStore.setState({
			initializationStatus: "ready",
			initializationError: undefined,
			contentVersion: 0,
			notesRoot: undefined,
		});
	});

	it("stays loading while storage initialization is pending", () => {
		const loadSpy = jest.spyOn(NoteService, "loadNote");
		useStorageStore.setState({
			initializationStatus: "pending",
			initializationError: undefined,
		});

		const { result } = renderHook(() => useLoadNote("note-1"));

		expect(result.current.isLoading).toBe(true);
		expect(result.current.error).toBeNull();
		expect(result.current.note).toBeNull();
		expect(loadSpy).not.toHaveBeenCalled();
	});

	it("surfaces the storage initialization error when startup failed", () => {
		const loadSpy = jest.spyOn(NoteService, "loadNote");
		useStorageStore.setState({
			initializationStatus: "failed",
			initializationError: "Storage is unavailable",
		});

		const { result } = renderHook(() => useLoadNote("note-1"));

		expect(result.current.isLoading).toBe(false);
		expect(result.current.error).toBe("Storage is unavailable");
		expect(result.current.note).toBeNull();
		expect(loadSpy).not.toHaveBeenCalled();
	});

	it("loads the note once storage is ready", async () => {
		jest.spyOn(NoteService, "loadNote").mockResolvedValue(makeNote());

		const { result } = renderHook(() => useLoadNote("note-1"));

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});
		expect(result.current.error).toBeNull();
		expect(result.current.note).toEqual(makeNote());
	});

	it("returns a not-found error when the note service resolves null", async () => {
		jest.spyOn(NoteService, "loadNote").mockResolvedValue(null);

		const { result } = renderHook(() => useLoadNote("missing-note"));

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});
		expect(result.current.note).toBeNull();
		expect(result.current.error).toBe("Note not found");
	});

	it("surfaces thrown note-loading errors", async () => {
		jest
			.spyOn(NoteService, "loadNote")
			.mockRejectedValue(new Error("Disk exploded"));

		const { result } = renderHook(() => useLoadNote("note-1"));

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});
		expect(result.current.note).toBeNull();
		expect(result.current.error).toBe("Disk exploded");
	});
});
