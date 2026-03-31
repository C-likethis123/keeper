import { NotesIndexService } from "@/services/notes/notesIndex";
import { useStorageStore } from "@/stores/storageStore";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import useNotes from "../useNotes";

jest.mock("@/hooks/useDebounce", () => ({
	useDebounce: (value: string) => value,
}));

jest.mock("@/services/notes/notesIndex", () => ({
	NotesIndexService: {
		listNotes: jest.fn(),
	},
}));

function makeListResult({
	count = 2,
	cursor,
	titlePrefix = "Note",
}: {
	count?: number;
	cursor?: number;
	titlePrefix?: string;
} = {}) {
	return {
		items: Array.from({ length: count }, (_, index) => ({
			noteId: `${titlePrefix.toLowerCase()}-${index + 1}`,
			title: `${titlePrefix} ${index + 1}`,
			summary: `Summary ${index + 1}`,
			updatedAt: 1710000000000 + index,
			isPinned: false,
			noteType: "note" as const,
			status: null,
		})),
		cursor,
	};
}

describe("useNotes", () => {
	const mockListNotes = jest.mocked(NotesIndexService.listNotes);

	beforeEach(() => {
		jest.clearAllMocks();
		useStorageStore.setState({
			initializationStatus: "pending",
			initializationError: undefined,
			contentVersion: 0,
		});
	});

	it("waits for storage readiness before loading notes", () => {
		const { result } = renderHook(() => useNotes());

		expect(result.current.isLoading).toBe(true);
		expect(result.current.notes).toEqual([]);
		expect(mockListNotes).not.toHaveBeenCalled();
	});

	it("surfaces storage initialization failures without querying the index", () => {
		useStorageStore.setState({
			initializationStatus: "failed",
			initializationError: "Storage is unavailable",
		});

		const { result } = renderHook(() => useNotes());

		expect(result.current.isLoading).toBe(false);
		expect(result.current.error).toBe("Storage is unavailable");
		expect(result.current.hasMore).toBe(false);
		expect(mockListNotes).not.toHaveBeenCalled();
	});

	it("loads notes and appends the next page when more results exist", async () => {
		mockListNotes
			.mockResolvedValueOnce(makeListResult({ count: 2, cursor: 2 }))
			.mockResolvedValueOnce(
				makeListResult({ count: 1, titlePrefix: "Extra" }),
			);
		useStorageStore.setState({ initializationStatus: "ready" });

		const { result } = renderHook(() => useNotes());

		await waitFor(() => {
			expect(result.current.notes).toHaveLength(2);
		});
		expect(result.current.hasMore).toBe(true);
		expect(mockListNotes).toHaveBeenNthCalledWith(1, "", 20, 0, {
			noteTypes: undefined,
			status: undefined,
		});

		await act(async () => {
			await result.current.loadMoreNotes();
		});

		await waitFor(() => {
			expect(result.current.notes).toHaveLength(3);
		});
		expect(result.current.hasMore).toBe(false);
		expect(mockListNotes).toHaveBeenNthCalledWith(2, "", 20, 2, {
			noteTypes: undefined,
			status: undefined,
		});
		expect(result.current.notes.map((note) => note.title)).toEqual([
			"Note 1",
			"Note 2",
			"Extra 1",
		]);
	});

	it("queues a fresh search while the current request is still in flight", async () => {
		let resolveFirstRequest: ((value: ReturnType<typeof makeListResult>) => void) | null =
			null;
		mockListNotes
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveFirstRequest = resolve;
					}),
			)
			.mockResolvedValueOnce(
				makeListResult({ count: 1, titlePrefix: "Updated" }),
			);
		useStorageStore.setState({ initializationStatus: "ready" });

		const { result } = renderHook(() => useNotes());

		await act(async () => {
			result.current.setQuery("Updated");
		});

		expect(mockListNotes).toHaveBeenCalledTimes(1);
		expect(mockListNotes).toHaveBeenNthCalledWith(1, "", 20, 0, {
			noteTypes: undefined,
			status: undefined,
		});

		await act(async () => {
			resolveFirstRequest?.(makeListResult({ count: 1, titlePrefix: "Initial" }));
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(mockListNotes).toHaveBeenCalledTimes(2);
		});
		expect(mockListNotes).toHaveBeenNthCalledWith(2, "Updated", 20, 0, {
			noteTypes: undefined,
			status: undefined,
		});

		await waitFor(() => {
			expect(result.current.notes.map((note) => note.title)).toEqual([
				"Updated 1",
			]);
		});
	});
});
