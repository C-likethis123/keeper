import { Dialog } from "@/components/shared/Dialog";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

it("opens modal, handles cancellation, and restores trigger focus", () => {
	const onDismiss = vi.fn();
	const onOpen = vi.fn();
	const trigger = document.createElement("button");
	document.body.append(trigger);
	trigger.focus();
	const { rerender } = render(
		<Dialog open label="Edit" onDismiss={onDismiss} onOpen={onOpen}>
			<button type="button">Save</button>
		</Dialog>,
	);
	const dialog = screen.getByRole("dialog", { name: "Edit" });
	expect(dialog).toHaveAttribute("open");
	expect(onOpen).toHaveBeenCalledOnce();
	const cancel = new Event("cancel", { cancelable: true });
	fireEvent(dialog, cancel);
	expect(cancel.defaultPrevented).toBe(true);
	expect(onDismiss).toHaveBeenCalledOnce();
	rerender(
		<Dialog open={false} label="Edit" onDismiss={onDismiss}>
			Hidden
		</Dialog>,
	);
	expect(trigger).toHaveFocus();
	expect(screen.queryByRole("dialog")).toBeNull();
	trigger.remove();
	vi.restoreAllMocks();
});
