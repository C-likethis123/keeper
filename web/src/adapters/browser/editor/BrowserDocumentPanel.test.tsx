import { darkTheme } from "@keeper/constants/themes/darkTheme";
import { storageEngine } from "@/services/storage/storageEngine";
import { ThemeProvider } from "@react-navigation/native";
import { act, cleanup, render, screen } from "@testing-library/react";
import { saveBytes } from "@web/services/media";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BrowserDocumentPanel } from "./BrowserDocumentPanel";

beforeEach(async () => {
	Object.defineProperties(URL, {
		createObjectURL: {
			configurable: true,
			value: vi.fn(() => "blob:document-panel"),
		},
		revokeObjectURL: { configurable: true, value: vi.fn() },
	});
	await storageEngine.initialize();
	await storageEngine.resetAllData();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

function renderPanel(
	path: string,
	onPositionChange = vi.fn(),
) {
	return render(
		<ThemeProvider value={darkTheme}>
			<BrowserDocumentPanel
				attachmentPath={path}
				noteId="document-note"
				onDismiss={() => undefined}
				onPositionChange={onPositionChange}
			/>
		</ThemeProvider>,
	);
}

it("shows recoverable fallback for missing attachment bytes", async () => {
	renderPanel("_attachments/missing.pdf");

	expect(
		await screen.findByText("Unable to load this document."),
	).toBeInTheDocument();
});

it("persists viewer position and releases object URL on unmount", async () => {
	const path = await saveBytes(
		new Uint8Array([37, 80, 68, 70]),
		"position.pdf",
		"attachments",
	);
	vi.useFakeTimers();
	const onPositionChange = vi.fn();
	const view = renderPanel(path, onPositionChange);
	await act(async () => {
		await vi.runAllTimersAsync();
	});

	window.dispatchEvent(
		new MessageEvent("message", { data: { type: "page", page: "7" } }),
	);
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1_000);
	});

	expect(onPositionChange).toHaveBeenCalledWith(path, "7");
	view.unmount();
	expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:document-panel");
});
