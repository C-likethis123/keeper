import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrowserWebPanel, normalizeBrowserUrl } from "./BrowserWebPanel";

afterEach(cleanup);

it.each([
	["example.com/path", "https://example.com/path"],
	[" http://localhost:4173/ ", "http://localhost:4173/"],
	["localhost:4173", "https://localhost:4173/"],
	["", null],
	["not a website", null],
	["javascript:alert(1)", null],
	["data:text/html,hello", null],
	["file:///tmp/note", null],
	["ftp://example.com", null],
	["https://user:password@example.com", null],
])("validates website address %s", (input, expected) => {
	expect(normalizeBrowserUrl(input)).toBe(expected);
});

it("navigates, reloads, opens externally, and closes without changing note source", () => {
	const onDismiss = vi.fn();
	render(
		<BrowserWebPanel
			initialUrl="https://example.com/source"
			onDismiss={onDismiss}
		/>,
	);
	const initialFrame = screen.getByTitle("Browser website");
	fireEvent.change(screen.getByRole("textbox", { name: "Website address" }), {
		target: { value: "example.org" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Go" }));
	const navigatedFrame = screen.getByTitle("Browser website");
	expect(navigatedFrame).toHaveAttribute("src", "https://example.org/");
	expect(navigatedFrame).not.toBe(initialFrame);
	expect(screen.getByRole("link", { name: "Open externally" })).toHaveAttribute(
		"href",
		"https://example.org/",
	);
	expect(navigatedFrame.getAttribute("sandbox")).not.toContain(
		"allow-same-origin",
	);
	fireEvent.click(screen.getByRole("button", { name: "Reload" }));
	expect(screen.getByTitle("Browser website")).not.toBe(navigatedFrame);
	fireEvent.click(screen.getByRole("button", { name: "Close browser pane" }));
	expect(onDismiss).toHaveBeenCalledOnce();
});

it("starts blank and rejects unsafe navigation while retaining current page", () => {
	render(<BrowserWebPanel initialUrl={null} onDismiss={() => undefined} />);
	expect(screen.queryByTitle("Browser website")).not.toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Reload" })).toBeDisabled();
	const address = screen.getByRole("textbox", { name: "Website address" });
	fireEvent.change(address, { target: { value: "https://example.com" } });
	fireEvent.click(screen.getByRole("button", { name: "Go" }));
	fireEvent.change(address, { target: { value: "javascript:alert(1)" } });
	fireEvent.click(screen.getByRole("button", { name: "Go" }));
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Enter a valid HTTP or HTTPS address.",
	);
	expect(screen.getByTitle("Browser website")).toHaveAttribute(
		"src",
		"https://example.com/",
	);
});
