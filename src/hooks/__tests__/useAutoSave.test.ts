import { createDocumentFromMarkdown } from "@/components/editor/core/Document";
import {
	registerPendingDispatchFlusher,
	unregisterPendingDispatchFlusher,
} from "@/components/editor/core/pendingDispatchRegistry";
import { GitService } from "@/services/git/gitService";
import {
	normalizeMarkdownForPersistence,
	persistEditorEntry,
} from "@/services/notes/editorEntryPersistence";
import { useEditorState } from "@/stores/editorStore";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { InteractionManager } from "react-native";
import { useAutoSave } from "../useAutoSave";

type InteractionTask = Parameters<
	typeof InteractionManager.runAfterInteractions
>[0];

function runInteractionTask(task: InteractionTask) {
	if (!task) {
		return Promise.resolve();
	}

	if (typeof task === "function") {
		return Promise.resolve(task());
	}

	return Promise.resolve(task.gen());
}

jest.mock("@/services/notes/editorEntryPersistence", () => ({
	normalizeMarkdownForPersistence: jest.fn((value: string) => value.trim()),
	persistEditorEntry: jest.fn(),
}));

jest.mock("@/services/git/gitService", () => ({
	GitService: {
		registerBackgroundSaveHandler: jest.fn(),
	},
}));

describe("useAutoSave", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		useEditorState.getState().resetState();
		useEditorState.setState({
			document: createDocumentFromMarkdown("Initial body"),
			preparedMarkdown: null,
			preparedVersion: null,
		});
		jest
			.spyOn(InteractionManager, "runAfterInteractions")
			.mockImplementation((task?: InteractionTask) => {
				const handle = Object.assign(
					Promise.resolve(runInteractionTask(task)),
					{
						done: jest.fn(),
						cancel: jest.fn(),
					},
				);
				return handle as ReturnType<
					typeof InteractionManager.runAfterInteractions
				>;
			});
	});

	afterEach(() => {
		act(() => {
			jest.runOnlyPendingTimers();
		});
		jest.useRealTimers();
	});

	it("does not persist unchanged note content during idle autosave", async () => {
		const { result, unmount } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: " Draft note ",
				content: " Initial body ",
				isPinned: false,
				noteType: "note",
			}),
		);

		await act(async () => {
			jest.advanceTimersByTime(60000);
			await Promise.resolve();
		});

		expect(result.current.status).toBe("idle");
		expect(persistEditorEntry).not.toHaveBeenCalled();

		unmount();
	});

	it("does not persist stale editor content before the loaded note is observed", async () => {
		useEditorState.getState().loadMarkdown("Stale editor body");
		const { result } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Fresh loaded body",
				isPinned: false,
				noteType: "note",
			}),
		);

		await act(async () => {
			await result.current.forceSave();
		});

		expect(persistEditorEntry).not.toHaveBeenCalled();
	});

	it("saves metadata changes with loaded note content before editor content changes", async () => {
		(persistEditorEntry as jest.Mock).mockResolvedValue(undefined);
		useEditorState.getState().loadMarkdown("Stale editor body");
		const { result, rerender } = renderHook(
			({ title }) =>
				useAutoSave({
					id: "note-1",
					title,
					content: "Fresh loaded body",
					isPinned: false,
					noteType: "note",
				}),
			{
				initialProps: { title: "Draft note" },
			},
		);

		rerender({ title: "Renamed note" });

		await act(async () => {
			await result.current.forceSave();
		});

		expect(persistEditorEntry).toHaveBeenCalledWith({
			id: "note-1",
			title: "Renamed note",
			content: "Fresh loaded body",
			isPinned: false,
			noteType: "note",
			status: undefined,
			isNewEntry: false,
		});
	});

	it("treats loading the incoming note content as a clean baseline", async () => {
		useEditorState.getState().loadMarkdown("Stale editor body");
		const { result } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Fresh loaded body",
				isPinned: false,
				noteType: "note",
			}),
		);

		act(() => {
			useEditorState.getState().loadMarkdown("Fresh loaded body");
		});

		await act(async () => {
			await result.current.forceSave();
		});

		expect(persistEditorEntry).not.toHaveBeenCalled();
	});

	it("persists dirty note changes after the idle interval and returns to idle after saved status", async () => {
		(persistEditorEntry as jest.Mock).mockResolvedValue(undefined);
		const onPersisted = jest.fn();
		const { result } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Initial body",
				isPinned: false,
				noteType: "note",
				onPersisted,
			}),
		);

		act(() => {
			useEditorState.getState().loadMarkdown("Updated body");
		});

		await act(async () => {
			jest.advanceTimersByTime(1500);
			await Promise.resolve();
		});

		await act(async () => {
			jest.advanceTimersByTime(60000);
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(persistEditorEntry).toHaveBeenCalledWith({
				id: "note-1",
				title: "Draft note",
				content: "Updated body",
				isPinned: false,
				noteType: "note",
				status: undefined,
				isNewEntry: false,
			});
		});
		expect(result.current.status).toBe("saved");
		expect(onPersisted).toHaveBeenCalledWith();

		act(() => {
			jest.advanceTimersByTime(1000);
		});

		expect(result.current.status).toBe("idle");
	});

	it("flushes pending editor dispatches before reading content in forceSave", async () => {
		(persistEditorEntry as jest.Mock).mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Initial body",
				isPinned: false,
				noteType: "note",
			}),
		);
		registerPendingDispatchFlusher("test-flusher", () => {
			useEditorState.getState().updateBlockContent(0, "Flushed body", 12);
		});

		try {
			await act(async () => {
				await result.current.forceSave();
			});
		} finally {
			unregisterPendingDispatchFlusher("test-flusher");
		}

		expect(persistEditorEntry).toHaveBeenCalledWith({
			id: "note-1",
			title: "Draft note",
			content: "Flushed body",
			isPinned: false,
			noteType: "note",
			status: undefined,
			isNewEntry: false,
		});
	});

	it("resets to idle when persistence fails and skips onPersisted", async () => {
		(persistEditorEntry as jest.Mock).mockRejectedValue(
			new Error("Save failed"),
		);
		const onPersisted = jest.fn();
		const { result } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Initial body",
				isPinned: false,
				noteType: "note",
				onPersisted,
			}),
		);

		act(() => {
			useEditorState.getState().loadMarkdown("Updated body");
		});

		await act(async () => {
			jest.advanceTimersByTime(61500);
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(persistEditorEntry).toHaveBeenCalledTimes(1);
		});
		expect(result.current.status).toBe("idle");
		expect(onPersisted).not.toHaveBeenCalled();
	});

	it("registers and clears the background save handler with the current forceSave callback", async () => {
		const { unmount } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Initial body",
				isPinned: false,
				noteType: "note",
			}),
		);

		expect(GitService.registerBackgroundSaveHandler).toHaveBeenCalledWith(
			expect.any(Function),
		);

		unmount();

		expect(GitService.registerBackgroundSaveHandler).toHaveBeenLastCalledWith(
			null,
		);
	});

	it("normalizes the initial saved snapshot from the incoming content", () => {
		renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: " Initial body ",
				isPinned: false,
				noteType: "note",
			}),
		);

		expect(normalizeMarkdownForPersistence).toHaveBeenCalledWith(
			" Initial body ",
		);
	});
});
