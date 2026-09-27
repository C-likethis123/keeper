import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { BrowserAttachVideoModal } from "./BrowserAttachVideoModal";

afterEach(cleanup);

it("keeps canonical unsupported URL validation and saves supported URLs", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn();
	render(
		<BrowserAttachVideoModal
			visible
			onDismiss={() => undefined}
			onRemove={() => undefined}
			onSave={onSave}
		/>,
	);
	const input = screen.getByPlaceholderText(
		"https://www.youtube.com/watch?v=...",
	);

	await user.type(input, "https://example.com/not-video");
	await user.click(screen.getByText("Save"));
	expect(screen.getByText("Not a valid YouTube URL")).toBeInTheDocument();
	expect(onSave).not.toHaveBeenCalled();

	await user.clear(input);
	await user.type(input, "https://youtu.be/dQw4w9WgXcQ");
	await user.click(screen.getByText("Save"));
	expect(onSave).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ");
});

it("removes current video through canonical modal", async () => {
	const user = userEvent.setup();
	const onRemove = vi.fn();
	render(
		<BrowserAttachVideoModal
			visible
			currentVideo="https://youtu.be/dQw4w9WgXcQ"
			onDismiss={() => undefined}
			onRemove={onRemove}
			onSave={() => undefined}
		/>,
	);

	await user.click(screen.getByText("Remove video"));
	expect(onRemove).toHaveBeenCalledOnce();
});
