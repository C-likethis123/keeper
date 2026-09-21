import "fake-indexeddb/auto";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureBrowserNoteVersion } from "@/services/noteHistory";
import { browserStorage } from "@/services/storage";
import { BrowserNoteHistoryModal } from "./BrowserNoteHistoryModal";

const oldNote = { id: "note-1", title: "Plan", content: "Old content", noteType: "note" as const, isPinned: false, lastUpdated: 1, modified: 1, status: null, createdAt: null, completedAt: null, attachment: null, attachedVideo: null, resourceUrl: null, documentPositions: null };
const currentNote = { ...oldNote, content: "Current content", lastUpdated: 2, modified: 2 };

describe("BrowserNoteHistoryModal", () => {
	beforeEach(async () => { await browserStorage.setState("note-history:v1:note-1", "[]"); });
	it("shows and restores saved browser versions", async () => {
		await captureBrowserNoteVersion(oldNote);
		const onRestore = vi.fn().mockResolvedValue(undefined);
		render(<BrowserNoteHistoryModal open note={currentNote} onDismiss={vi.fn()} onRestore={onRestore} />);

		fireEvent.click(await screen.findByRole("button", { name: /Old content/ }));
		fireEvent.click(screen.getByRole("button", { name: "Restore this version" }));
		expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ note: oldNote }));
	});
});
