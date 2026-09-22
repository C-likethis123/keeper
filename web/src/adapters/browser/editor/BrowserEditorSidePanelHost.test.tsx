import { browserStorage } from "@web/services/storage";
import { darkTheme } from "@keeper/constants/themes/darkTheme";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@react-navigation/native";
import { BrowserEditorSidePanelHost } from "./BrowserEditorSidePanelHost";

const SPLIT_RATIO_KEY = "doc-split-ratio";

it("persists keyboard split resizing with the Expo layout key", async () => {
	await browserStorage.setState(SPLIT_RATIO_KEY, "0.45");
	render(
		<ThemeProvider value={darkTheme}>
			<BrowserEditorSidePanelHost
				activePanel="article"
				articleUrl="https://example.com"
				attachmentPath={null}
				noteId="note-1"
				videoUrl={null}
				onArticleDismiss={() => undefined}
				onAttachmentDismiss={() => undefined}
				onDocumentPositionChange={() => undefined}
				onTextSelected={() => undefined}
				onVideoDismiss={() => undefined}
			>
				<div>Editor</div>
			</BrowserEditorSidePanelHost>
		</ThemeProvider>,
	);

	fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowRight" });

	await waitFor(async () =>
		expect(await browserStorage.getState(SPLIT_RATIO_KEY)).toBe("0.5"),
	);
});
