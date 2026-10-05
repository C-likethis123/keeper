import { vi } from "vitest";
import {
	registerPendingDispatchFlusher,
	unregisterPendingDispatchFlusher,
} from "@/components/editor/core/pendingDispatchRegistry";
import {
	normalizeMarkdownForPersistence,
	persistEditorEntry,
} from "@/services/notes/editorEntryPersistence";
import { act, renderHook } from "@testing-library/react";
import { useAutoSave } from "../useAutoSave";

type UseAutoSaveResult = ReturnType<typeof useAutoSave>;
let currentContent = "Initial body";

vi.mock("@/services/notes/editorEntryPersistence", () => ({
	normalizeMarkdownForPersistence: vi.fn((value: string) => value.trim()),
	persistEditorEntry: vi.fn(),
}));

describe("useAutoSave", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		currentContent = "Initial body";
	});

	afterEach(() => {
		act(() => {
			vi.runOnlyPendingTimers();
		});
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("does not persist unchanged note content during idle autosave", async () => {
		const { result, unmount } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: " Draft note ",
				content: " Initial body ",
				currentContent,
				getCurrentContent: () => currentContent,
				isPinned: false,
				noteType: "note",
			}),
		);

		await act(async () => {
			vi.advanceTimersByTime(60000);
			await Promise.resolve();
		});

		expect(result.current.status).toBe("idle");
		expect(persistEditorEntry).not.toHaveBeenCalled();

		unmount();
	});

	it("does not persist stale editor content before the loaded note is observed", async () => {
		currentContent = "Fresh loaded body";
		const { result, rerender } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Fresh loaded body",
				currentContent,
				getCurrentContent: () => currentContent,
				isPinned: false,
				noteType: "note",
			}),
		);

		await act(async () => {
			await result.current.forceSave();
		});

		expect(persistEditorEntry).not.toHaveBeenCalled();
	});

	it("allows a later dirty save after a clean forceSave", async () => {
		vi.mocked(persistEditorEntry).mockResolvedValue(undefined);
		const { result, rerender } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Initial body",
				currentContent,
				getCurrentContent: () => currentContent,
				isPinned: false,
				noteType: "note",
			}),
		);

		await act(async () => {
			await result.current.forceSave();
		});

		expect(persistEditorEntry).not.toHaveBeenCalled();

		act(() => {
			currentContent = "Updated body";
		});
		rerender(undefined);

		await act(async () => {
			await result.current.forceSave();
		});

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

	it("saves latest ref content when editor revision changes without content prop churn", async () => {
		vi.mocked(persistEditorEntry).mockResolvedValue(undefined);
		let revision = 0;
		const { result, rerender } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Initial body",
				currentContent: "Initial body",
				currentContentRevision: revision,
				getCurrentContent: () => currentContent,
				isPinned: false,
				noteType: "note",
			}),
		);

		act(() => {
			currentContent = "Typed A";
			currentContent = "Typed AB";
			currentContent = "Typed ABC";
			revision += 1;
		});
		rerender(undefined);

		await act(async () => {
			await result.current.forceSave();
		});

		expect(persistEditorEntry).toHaveBeenCalledWith({
			id: "note-1",
			title: "Draft note",
			content: "Typed ABC",
			isPinned: false,
			noteType: "note",
			status: undefined,
			isNewEntry: false,
		});
	});

	it("saves metadata changes with loaded note content before editor content changes", async () => {
		vi.mocked(persistEditorEntry).mockResolvedValue(undefined);
		currentContent = "Fresh loaded body";
		const { result, rerender } = renderHook<
			UseAutoSaveResult,
			{ title: string }
		>(
			({ title }) =>
				useAutoSave({
					id: "note-1",
					title,
					content: "Fresh loaded body",
					currentContent,
					getCurrentContent: () => currentContent,
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
		currentContent = "Fresh loaded body";
		const { result, rerender } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Fresh loaded body",
				currentContent,
				getCurrentContent: () => currentContent,
				isPinned: false,
				noteType: "note",
			}),
		);

		act(() => {
			currentContent = "Fresh loaded body";
		});

		await act(async () => {
			await result.current.forceSave();
		});

		expect(persistEditorEntry).not.toHaveBeenCalled();
	});

	it("does not mark unsaved title changes as saved when editor reports baseline content", async () => {
		vi.mocked(persistEditorEntry).mockResolvedValue(undefined);
		const { result, rerender } = renderHook<
			UseAutoSaveResult,
			{ title: string }
		>(
			({ title }) =>
				useAutoSave({
					id: "note-1",
					title,
					content: "Initial body",
					currentContent,
					getCurrentContent: () => currentContent,
					isPinned: false,
					noteType: "note",
				}),
			{
				initialProps: { title: "Draft note" },
			},
		);

		rerender({ title: "Renamed note" });
		act(() => {
			currentContent = "Edited body";
		});
		act(() => {
			currentContent = "Initial body";
		});

		await act(async () => {
			await result.current.forceSave();
		});

		expect(persistEditorEntry).toHaveBeenCalledWith({
			id: "note-1",
			title: "Renamed note",
			content: "Initial body",
			isPinned: false,
			noteType: "note",
			status: undefined,
			isNewEntry: false,
		});
	});

	it("force saves content reverted to the loaded baseline after a saved edit", async () => {
		vi.mocked(persistEditorEntry).mockResolvedValue(undefined);
		const { result, rerender } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Initial body",
				currentContent,
				getCurrentContent: () => currentContent,
				isPinned: false,
				noteType: "note",
			}),
		);

		act(() => {
			currentContent = "Updated body";
		});
		rerender(undefined);

		await act(async () => {
			await result.current.forceSave();
		});

		act(() => {
			currentContent = "Initial body";
		});
		rerender(undefined);

		await act(async () => {
			await result.current.forceSave();
		});

		expect(persistEditorEntry).toHaveBeenLastCalledWith({
			id: "note-1",
			title: "Draft note",
			content: "Initial body",
			isPinned: false,
			noteType: "note",
			status: undefined,
			isNewEntry: false,
		});
		expect(persistEditorEntry).toHaveBeenCalledTimes(2);
	});

	it("persists dirty note changes after the idle interval and returns to idle after saved status", async () => {
		vi.mocked(persistEditorEntry).mockResolvedValue(undefined);
		const onPersisted = vi.fn();
		const { result, rerender } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Initial body",
				currentContent,
				getCurrentContent: () => currentContent,
				isPinned: false,
				noteType: "note",
				onPersisted,
			}),
		);

		act(() => {
			currentContent = "Updated body";
		});
		rerender(undefined);

		await act(async () => {
			vi.advanceTimersByTime(1999);
			await Promise.resolve();
		});

		expect(persistEditorEntry).not.toHaveBeenCalled();

		await act(async () => {
			vi.advanceTimersByTime(1);
			await Promise.resolve();
		});

		expect(persistEditorEntry).toHaveBeenCalledWith({
			id: "note-1",
			title: "Draft note",
			content: "Updated body",
			isPinned: false,
			noteType: "note",
			status: undefined,
			isNewEntry: false,
		});
		expect(result.current.status).toBe("saved");
		expect(onPersisted).toHaveBeenCalledWith({
			content: "Updated body",
			persistedAt: expect.any(Number),
		});

		act(() => {
			vi.advanceTimersByTime(1000);
		});

		expect(result.current.status).toBe("idle");
	});

	it("persists dirty title changes after the idle interval", async () => {
		vi.mocked(persistEditorEntry).mockResolvedValue(undefined);
		const { rerender } = renderHook<UseAutoSaveResult, { title: string }>(
			({ title }) =>
				useAutoSave({
					id: "note-1",
					title,
					content: "Initial body",
					currentContent,
					getCurrentContent: () => currentContent,
					isPinned: false,
					noteType: "note",
				}),
			{
				initialProps: { title: "Draft note" },
			},
		);

		rerender({ title: "Renamed note" });

		await act(async () => {
			vi.advanceTimersByTime(2000);
			await Promise.resolve();
		});

		expect(persistEditorEntry).toHaveBeenCalledWith({
			id: "note-1",
			title: "Renamed note",
			content: "Initial body",
			isPinned: false,
			noteType: "note",
			status: undefined,
			isNewEntry: false,
		});
	});

	it("persists attached video metadata changes with the current markdown", async () => {
		vi.mocked(persistEditorEntry).mockResolvedValue(undefined);
		const { rerender } = renderHook<
			UseAutoSaveResult,
			{ attachedVideo: string | null }
		>(
			({ attachedVideo }) =>
				useAutoSave({
					id: "note-1",
					title: "Draft note",
					content: "Initial body",
					currentContent,
					getCurrentContent: () => currentContent,
					isPinned: false,
					noteType: "note",
					attachedVideo,
				}),
			{
				initialProps: { attachedVideo: null as string | null },
			},
		);

		act(() => {
			currentContent = "Body after attach";
		});
		rerender({
			attachedVideo: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		});

		await act(async () => {
			vi.advanceTimersByTime(2000);
			await Promise.resolve();
		});

		expect(persistEditorEntry).toHaveBeenCalledWith({
			id: "note-1",
			title: "Draft note",
			content: "Body after attach",
			isPinned: false,
			noteType: "note",
			status: undefined,
			attachedVideo: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			isNewEntry: false,
		});
	});

	it("force saves cleared document metadata from the latest render", async () => {
		vi.mocked(persistEditorEntry).mockResolvedValue(undefined);
		const { result, rerender } = renderHook<
			UseAutoSaveResult,
			{
				attachment: string | null;
				documentPositions: Record<string, string> | null;
			}
		>(
			({ attachment, documentPositions }) =>
				useAutoSave({
					id: "note-1",
					title: "Draft note",
					content: "Initial body",
					currentContent,
					getCurrentContent: () => currentContent,
					isPinned: false,
					noteType: "note",
					attachment,
					documentPositions,
				}),
			{
				initialProps: {
					attachment: "_attachments/paper.pdf",
					documentPositions: { "_attachments/paper.pdf": "4" },
				},
			},
		);

		rerender({ attachment: null, documentPositions: null });

		await act(async () => {
			await result.current.forceSave();
		});

		expect(persistEditorEntry).toHaveBeenCalledWith({
			id: "note-1",
			title: "Draft note",
			content: "Initial body",
			isPinned: false,
			noteType: "note",
			status: undefined,
			attachment: null,
			documentPositions: null,
			isNewEntry: false,
		});
	});

	it("flushes pending editor dispatches before reading content in forceSave", async () => {
		vi.mocked(persistEditorEntry).mockResolvedValue(undefined);
		const { result, rerender } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Initial body",
				currentContent,
				getCurrentContent: () => currentContent,
				isPinned: false,
				noteType: "note",
			}),
		);
		registerPendingDispatchFlusher("test-flusher", () => {
			currentContent = "Flushed body";
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

	it.each(["visibilitychange", "pagehide"])(
		"persists dirty pending text on browser %s",
		async (eventType) => {
			vi.mocked(persistEditorEntry).mockResolvedValue(undefined);
			const { rerender } = renderHook(() =>
				useAutoSave({
					id: "note-1",
					title: "Draft note",
					content: "Initial body",
					currentContent,
					getCurrentContent: () => currentContent,
					isPinned: false,
					noteType: "note",
				}),
			);
			registerPendingDispatchFlusher("test-flusher", () => {
				currentContent = "Leaving body";
			});

			try {
				await act(async () => {
					vi.spyOn(document, "visibilityState", "get").mockReturnValue(
						"hidden",
					);
					if (eventType === "visibilitychange")
						document.dispatchEvent(new Event(eventType));
					else window.dispatchEvent(new Event(eventType));
					await Promise.resolve();
				});
			} finally {
				unregisterPendingDispatchFlusher("test-flusher");
			}

			expect(persistEditorEntry).toHaveBeenCalledWith({
				id: "note-1",
				title: "Draft note",
				content: "Leaving body",
				isPinned: false,
				noteType: "note",
				status: undefined,
				isNewEntry: false,
			});
		},
	);

	it("runs a follow-up save when content changes during an in-flight save", async () => {
		let resolveFirstSave: (() => void) | undefined;
		vi.mocked(persistEditorEntry).mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveFirstSave = resolve;
				}),
		);
		vi.mocked(persistEditorEntry).mockResolvedValue(undefined);
		const { rerender } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Initial body",
				currentContent,
				getCurrentContent: () => currentContent,
				isPinned: false,
				noteType: "note",
			}),
		);

		act(() => {
			currentContent = "First edit";
		});
		rerender(undefined);
		await act(async () => {
			vi.advanceTimersByTime(2000);
			await Promise.resolve();
		});

		act(() => {
			currentContent = "Second edit";
		});
		rerender(undefined);
		await act(async () => {
			vi.advanceTimersByTime(0);
			await Promise.resolve();
		});

		await act(async () => {
			resolveFirstSave?.();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(persistEditorEntry).toHaveBeenLastCalledWith({
			id: "note-1",
			title: "Draft note",
			content: "Second edit",
			isPinned: false,
			noteType: "note",
			status: undefined,
			isNewEntry: false,
		});
	});

	it("waits for the follow-up save when forceSave is called during an in-flight save", async () => {
		let resolveFirstSave: (() => void) | undefined;
		vi.mocked(persistEditorEntry).mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveFirstSave = resolve;
				}),
		);
		vi.mocked(persistEditorEntry).mockResolvedValue(undefined);
		const { result, rerender } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Initial body",
				currentContent,
				getCurrentContent: () => currentContent,
				isPinned: false,
				noteType: "note",
			}),
		);

		act(() => {
			currentContent = "First edit";
		});

		let firstSave: Promise<void> | undefined;
		await act(async () => {
			firstSave = result.current.forceSave();
			await Promise.resolve();
		});

		act(() => {
			currentContent = "Second edit";
		});

		let secondSaveResolved = false;
		const secondSave = result.current.forceSave().then(() => {
			secondSaveResolved = true;
		});
		await act(async () => {
			await Promise.resolve();
		});

		expect(secondSaveResolved).toBe(false);

		await act(async () => {
			resolveFirstSave?.();
			await firstSave;
			await secondSave;
		});

		expect(persistEditorEntry).toHaveBeenLastCalledWith({
			id: "note-1",
			title: "Draft note",
			content: "Second edit",
			isPinned: false,
			noteType: "note",
			status: undefined,
			isNewEntry: false,
		});
		expect(secondSaveResolved).toBe(true);
	});

	it("resets to idle when persistence fails and skips onPersisted", async () => {
		vi.mocked(persistEditorEntry).mockRejectedValue(new Error("Save failed"));
		const onPersisted = vi.fn();
		const { result, rerender } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Initial body",
				currentContent,
				getCurrentContent: () => currentContent,
				isPinned: false,
				noteType: "note",
				onPersisted,
			}),
		);

		act(() => {
			currentContent = "Updated body";
		});
		rerender(undefined);

		await act(async () => {
			vi.advanceTimersByTime(61500);
			await Promise.resolve();
		});

		expect(persistEditorEntry).toHaveBeenCalledTimes(1);
		expect(result.current.status).toBe("idle");
		expect(onPersisted).not.toHaveBeenCalled();
	});

	it("rejects forceSave when persistence fails", async () => {
		const saveError = new Error("Save failed");
		vi.mocked(persistEditorEntry).mockRejectedValue(saveError);
		const { result } = renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: "Initial body",
				currentContent,
				getCurrentContent: () => currentContent,
				isPinned: false,
				noteType: "note",
			}),
		);

		act(() => {
			currentContent = "Updated body";
		});

		await act(async () => {
			await expect(result.current.forceSave()).rejects.toBe(saveError);
		});
		expect(result.current.status).toBe("idle");
	});

	it("normalizes the initial saved snapshot from the incoming content", () => {
		renderHook(() =>
			useAutoSave({
				id: "note-1",
				title: "Draft note",
				content: " Initial body ",
				currentContent,
				getCurrentContent: () => currentContent,
				isPinned: false,
				noteType: "note",
			}),
		);

		expect(normalizeMarkdownForPersistence).toHaveBeenCalledWith(
			" Initial body ",
		);
	});
});
