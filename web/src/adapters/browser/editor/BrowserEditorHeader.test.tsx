import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BrowserEditorHeader } from "./BrowserEditorHeader";

describe("BrowserEditorHeader", () => {
	it("maps the shared header actions to DOM controls", () => {
		const onChangeTitle = vi.fn(); const onBack = vi.fn(); const onShowHistory = vi.fn(); const onTogglePin = vi.fn(); const onDelete = vi.fn();
		render(<BrowserEditorHeader title="Plan" status="saved" isPinned={false} onChangeTitle={onChangeTitle} onBlurTitle={vi.fn()} onSubmitEditing={vi.fn()} onBack={onBack} onShowHistory={onShowHistory} onTogglePin={onTogglePin} onDelete={onDelete} />);

		fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Next plan" } });
		fireEvent.click(screen.getByRole("button", { name: "Back" }));
		fireEvent.click(screen.getByRole("button", { name: "Version history" }));
		fireEvent.click(screen.getByRole("button", { name: "Pin note" }));
		fireEvent.click(screen.getByRole("button", { name: "Delete note" }));

		expect(onChangeTitle).toHaveBeenCalledWith("Next plan");
		expect(onBack).toHaveBeenCalledOnce(); expect(onShowHistory).toHaveBeenCalledOnce(); expect(onTogglePin).toHaveBeenCalledOnce(); expect(onDelete).toHaveBeenCalledOnce();
		expect(screen.getByText("Saved")).toBeInTheDocument();
	});
});
