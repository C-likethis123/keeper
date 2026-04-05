import { useEditorState } from "@/stores/editorStore";
import {
	act,
	fireEvent,
	screen,
	userEvent,
	waitFor,
} from "@testing-library/react-native";
import React from "react";
import { TextInput } from "react-native";
import {
	mockListNotes,
	mockLoadNote,
	mockSaveNote,
	renderEditor,
	resetHybridEditorHarness,
	restorePlatformOs,
} from "./HybridEditorWikiLinkTestUtils";

function createDeferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe("HybridEditor wikilink editing flows", () => {
	beforeEach(() => {
		resetHybridEditorHarness("ios");
		mockListNotes.mockResolvedValue({ items: [] });
	});

	afterEach(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
		await new Promise((resolve) => setTimeout(resolve, 0));
	});

	afterAll(() => {
		restorePlatformOs();
	});

	it("seeds the modal query from text typed after the wikilink trigger", async () => {
		renderEditor("");

		const input = screen.UNSAFE_getByType(TextInput);
		fireEvent(input, "focus");
		fireEvent.changeText(input, "[[Project");

		const modalInput = await screen.findByPlaceholderText(
			"Search or create notes...",
		);
		expect(modalInput).toHaveDisplayValue("Project");
		await waitFor(() => {
			expect(mockListNotes).toHaveBeenCalledWith(
				"Project",
				expect.any(Number),
				0,
			);
		});
		expect(useEditorState.getState().getContent()).toBe("[[");
	});

	it("replaces the typed trigger with the selected wikilink", async () => {
		const user = userEvent.setup();
		mockListNotes.mockResolvedValue({
			items: [
				{
					noteId: "note-123",
					title: "Project Alpha",
					summary: "",
					isPinned: false,
					updatedAt: 0,
					noteType: "note",
				},
			],
		});

		renderEditor("");

		const input = screen.UNSAFE_getByType(TextInput);
		fireEvent(input, "focus");
		fireEvent.changeText(input, "[[Project");

		await user.press(await screen.findByText("Project Alpha"));

		await waitFor(() => {
			expect(useEditorState.getState().getContent()).toBe("[[Project Alpha]]");
		});
		expect(useEditorState.getState().selection?.focus.offset).toBe(
			"[[Project Alpha]]".length,
		);
		expect(
			screen.queryByPlaceholderText("Search or create notes..."),
		).not.toBeOnTheScreen();
	});

	it("removes the trigger token and restores focus when the modal is cancelled", async () => {
		renderEditor("Before ");

		const input = screen.UNSAFE_getByType(TextInput);
		fireEvent(input, "focus");
		fireEvent.changeText(input, "Before [[Draft");

		const modalInput = await screen.findByPlaceholderText(
			"Search or create notes...",
		);
		expect(modalInput).toHaveDisplayValue("Draft");

		fireEvent(modalInput, "keyPress", { nativeEvent: { key: "Escape" } });

		await waitFor(() => {
			expect(
				screen.queryByPlaceholderText("Search or create notes..."),
			).not.toBeOnTheScreen();
		});
		expect(useEditorState.getState().getContent()).toBe("Before ");
		await waitFor(() => {
			expect(useEditorState.getState().selection?.focus.blockIndex).toBe(0);
		});
		expect(useEditorState.getState().selection?.focus.offset).toBe(
			"Before ".length,
		);
	});

	it("hands off cleanly from slash commands to wikilinks without corrupting text", async () => {
		renderEditor("");

		const input = screen.UNSAFE_getByType(TextInput);
		fireEvent(input, "focus");
		fireEvent.changeText(input, "/");

		expect(
			await screen.findByPlaceholderText("Type a command..."),
		).toBeOnTheScreen();

		fireEvent.changeText(input, "[[Roadmap");

		const modalInput = await screen.findByPlaceholderText(
			"Search or create notes...",
		);
		expect(modalInput).toHaveDisplayValue("Roadmap");
		await waitFor(() => {
			expect(
				screen.queryByPlaceholderText("Type a command..."),
			).not.toBeOnTheScreen();
		});
		expect(useEditorState.getState().getContent()).toBe("[[");
	});

	it("converts typed todo text when leaving the block and links the todo in the background", async () => {
		mockListNotes.mockResolvedValue({ items: [] });
		const saveDeferred =
			createDeferred<Awaited<ReturnType<typeof mockSaveNote>>>();
		mockSaveNote.mockReturnValue(saveDeferred.promise);

		renderEditor("todo do this\nNext block");

		const inputs = screen.UNSAFE_getAllByType(TextInput);
		fireEvent(inputs[0], "focus");
		fireEvent(inputs[0], "selectionChange", {
			nativeEvent: { selection: { start: 12, end: 12 } },
		});
		expect(useEditorState.getState().document.blocks[0]).toEqual(
			expect.objectContaining({
				type: "paragraph",
				content: "todo do this",
			}),
		);

		fireEvent(inputs[0], "blur");
		fireEvent(inputs[1], "focus");

		await waitFor(() => {
			expect(useEditorState.getState().document.blocks[0]).toEqual(
				expect.objectContaining({
					type: "checkboxList",
					content: "[[TODO: do this]]",
					attributes: expect.objectContaining({
						checked: false,
						listLevel: 0,
					}),
				}),
			);
		});
		expect(
			useEditorState.getState().document.blocks[0]?.attributes?.linkedNoteId,
		).toBeUndefined();
		expect(mockSaveNote).toHaveBeenCalledWith(
			expect.objectContaining({
				noteType: "todo",
				title: "TODO: do this",
				status: "open",
				createdAt: expect.any(Number),
				completedAt: null,
			}),
			true,
		);

		saveDeferred.resolve({
			id: "todo-note-id",
			title: "TODO: do this",
			content: "",
			lastUpdated: 1,
			isPinned: false,
			noteType: "todo",
			status: "open",
			createdAt: 1710000000000,
			completedAt: null,
		});

		await waitFor(() => {
			expect(useEditorState.getState().document.blocks[0]?.attributes).toEqual(
				expect.objectContaining({
					checked: false,
					listLevel: 0,
					linkedNoteId: "todo-note-id",
				}),
			);
		});
		expect(
			screen.queryByPlaceholderText("Search or create notes..."),
		).not.toBeOnTheScreen();
	});

	it("converts a matching todo when the block loses focus entirely", async () => {
		mockSaveNote.mockResolvedValue({
			id: "todo-note-id-blur",
			title: "TODO: Ship blur",
			content: "",
			lastUpdated: 1,
			isPinned: false,
			noteType: "todo",
			status: "open",
			createdAt: 1710000000000,
			completedAt: null,
		});

		renderEditor("");

		const input = screen.UNSAFE_getByType(TextInput);
		fireEvent(input, "focus");
		fireEvent.changeText(input, "todo: Ship blur");
		fireEvent(input, "selectionChange", {
			nativeEvent: { selection: { start: 15, end: 15 } },
		});

		expect(useEditorState.getState().document.blocks[0]).toEqual(
			expect.objectContaining({
				type: "paragraph",
				content: "todo: Ship blur",
			}),
		);

		fireEvent(input, "blur");

		await waitFor(() => {
			expect(useEditorState.getState().document.blocks[0]).toEqual(
				expect.objectContaining({
					type: "checkboxList",
					content: "[[TODO: Ship blur]]",
					attributes: expect.objectContaining({
						checked: false,
						listLevel: 0,
						linkedNoteId: "todo-note-id-blur",
					}),
				}),
			);
		});
	});

	it("creates tracked todo blocks when Enter is used on a typed todo line", async () => {
		mockListNotes.mockResolvedValue({ items: [] });
		mockSaveNote.mockResolvedValue({
			id: "todo-note-id-2",
			title: "TODO: Ship release",
			content: "",
			lastUpdated: 1,
			isPinned: false,
			noteType: "todo",
			status: "open",
			createdAt: 1710000000000,
			completedAt: null,
		});

		renderEditor("");

		const input = screen.UNSAFE_getByType(TextInput);
		fireEvent(input, "focus");
		fireEvent.changeText(input, "todo: Ship release");
		fireEvent(input, "selectionChange", {
			nativeEvent: { selection: { start: 18, end: 18 } },
		});
		fireEvent(input, "keyPress", { nativeEvent: { key: "Enter" } });

		await waitFor(() => {
			expect(useEditorState.getState().document.blocks).toHaveLength(2);
		});
		expect(useEditorState.getState().document.blocks[0]).toEqual(
			expect.objectContaining({
				type: "checkboxList",
				content: "[[TODO: Ship release]]",
				attributes: expect.objectContaining({
					checked: false,
					listLevel: 0,
					linkedNoteId: "todo-note-id-2",
				}),
			}),
		);
		expect(mockSaveNote).toHaveBeenCalledWith(
			expect.objectContaining({
				noteType: "todo",
				title: "TODO: Ship release",
				status: "open",
				createdAt: expect.any(Number),
				completedAt: null,
			}),
			true,
		);
	});

	it("converts tracked todos in bullet list items without losing indentation", async () => {
		mockSaveNote.mockResolvedValue({
			id: "todo-note-id-bullet",
			title: "TODO: Ship release",
			content: "",
			lastUpdated: 1,
			isPinned: false,
			noteType: "todo",
			status: "open",
			createdAt: 1710000000000,
			completedAt: null,
		});

		renderEditor("- todo: Ship release");

		const input = screen.UNSAFE_getByType(TextInput);
		fireEvent(input, "focus");
		fireEvent(input, "selectionChange", {
			nativeEvent: { selection: { start: 18, end: 18 } },
		});
		fireEvent(input, "keyPress", { nativeEvent: { key: "Enter" } });

		await waitFor(() => {
			expect(useEditorState.getState().document.blocks).toHaveLength(2);
		});
		expect(useEditorState.getState().document.blocks[0]).toEqual(
			expect.objectContaining({
				type: "checkboxList",
				content: "[[TODO: Ship release]]",
				attributes: expect.objectContaining({
					checked: false,
					listLevel: 0,
					linkedNoteId: "todo-note-id-bullet",
				}),
			}),
		);
		expect(useEditorState.getState().document.blocks[1]).toEqual(
			expect.objectContaining({
				type: "checkboxList",
				content: "",
				attributes: expect.objectContaining({
					checked: false,
					listLevel: 0,
				}),
			}),
		);
	});

	it("converts tracked todos in numbered list items and preserves nesting", async () => {
		mockSaveNote.mockResolvedValue({
			id: "todo-note-id-numbered",
			title: "TODO: Ship release",
			content: "",
			lastUpdated: 1,
			isPinned: false,
			noteType: "todo",
			status: "open",
			createdAt: 1710000000000,
			completedAt: null,
		});

		renderEditor("  1. todo: Ship release");

		const input = screen.UNSAFE_getByType(TextInput);
		fireEvent(input, "focus");
		fireEvent(input, "selectionChange", {
			nativeEvent: { selection: { start: 18, end: 18 } },
		});
		fireEvent(input, "keyPress", { nativeEvent: { key: "Enter" } });

		await waitFor(() => {
			expect(useEditorState.getState().document.blocks).toHaveLength(2);
		});
		expect(useEditorState.getState().document.blocks[0]).toEqual(
			expect.objectContaining({
				type: "checkboxList",
				content: "[[TODO: Ship release]]",
				attributes: expect.objectContaining({
					checked: false,
					listLevel: 1,
					linkedNoteId: "todo-note-id-numbered",
				}),
			}),
		);
		expect(useEditorState.getState().document.blocks[1]).toEqual(
			expect.objectContaining({
				type: "checkboxList",
				content: "",
				attributes: expect.objectContaining({
					checked: false,
					listLevel: 1,
				}),
			}),
		);
	});

	it("syncs linked todo status when the checkbox is toggled", async () => {
		mockLoadNote.mockResolvedValue({
			id: "todo-note-id",
			title: "TODO: Ship release",
			content: "",
			lastUpdated: 1,
			isPinned: false,
			noteType: "todo",
			status: "open",
			createdAt: 1710000000000,
			completedAt: null,
		});
		mockSaveNote.mockResolvedValue({
			id: "todo-note-id",
			title: "TODO: Ship release",
			content: "",
			lastUpdated: 1,
			isPinned: false,
			noteType: "todo",
			status: "done",
			createdAt: 1710000000000,
			completedAt: 1710003600000,
		});

		renderEditor("- [ ] [[TODO: Ship release]]");
		act(() => {
			useEditorState.getState().updateBlockAttributes(0, {
				...useEditorState.getState().document.blocks[0]?.attributes,
				linkedNoteId: "todo-note-id",
			});
		});

		fireEvent.press(screen.getByTestId("checkbox-list-marker"));

		await waitFor(() => {
			expect(useEditorState.getState().document.blocks[0]?.attributes).toEqual(
				expect.objectContaining({ checked: true }),
			);
		});
		expect(screen.getByRole("checkbox")).toBeChecked();
		await waitFor(() => {
			expect(mockSaveNote).toHaveBeenCalledWith(
				{
					id: "todo-note-id",
					title: "TODO: Ship release",
					content: "",
					isPinned: false,
					noteType: "todo",
					status: "done",
					createdAt: 1710000000000,
					completedAt: expect.any(Number),
				},
				false,
			);
		});
	});
});
