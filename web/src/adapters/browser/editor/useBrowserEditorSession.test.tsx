import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBrowserEditorSession } from "./useBrowserEditorSession";

const note = { id: "note-1", title: "Plan", content: "Before", noteType: "note" as const, isPinned: false, updatedAt: 1 };

describe("useBrowserEditorSession", () => {
	it("applies shared draft patches before persistence", async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() => useBrowserEditorSession(note, { save, remove: vi.fn().mockResolvedValue(undefined) }));
		act(() => result.current.patch({ title: "Next plan", content: "After" }));
		expect(result.current.draft).toMatchObject({ title: "Next plan", content: "After" });

		await act(async () => { await result.current.save(); });
		expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: "Next plan", content: "After" }));
		expect(result.current.status).toBe("saved");
	});
});
