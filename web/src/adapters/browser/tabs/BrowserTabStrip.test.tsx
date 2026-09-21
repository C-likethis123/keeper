import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BrowserTabStrip } from "./BrowserTabStrip";

describe("BrowserTabStrip", () => {
	it("maps shared tab actions to browser controls", () => {
		const onActivateTab = vi.fn();
		const onCloseTab = vi.fn();
		const onTogglePin = vi.fn();
		render(<BrowserTabStrip tabs={[{ id: "tab-1", noteId: "note-1", title: "Plan", isPinned: false, isNew: false }]} activeTabId="tab-1" activeView="note" onActivateHome={vi.fn()} onActivateTab={onActivateTab} onCloseTab={onCloseTab} onTogglePin={onTogglePin} />);

		fireEvent.click(screen.getByRole("tab", { name: "Plan" }));
		fireEvent.click(screen.getByRole("button", { name: "Pin Plan" }));
		fireEvent.click(screen.getByRole("button", { name: "Close Plan" }));

		expect(onActivateTab).toHaveBeenCalledWith(expect.objectContaining({ id: "tab-1", noteId: "note-1" }));
		expect(onTogglePin).toHaveBeenCalledWith("tab-1");
		expect(onCloseTab).toHaveBeenCalledWith("tab-1");
	});
});
