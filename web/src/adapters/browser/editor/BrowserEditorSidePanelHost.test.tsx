import { browserStorage } from "@web/services/storage";
import { darkTheme } from "@keeper/constants/themes/darkTheme";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@/constants/themes/ThemeProvider";
import { BrowserEditorSidePanelHost } from "./BrowserEditorSidePanelHost";

const SPLIT_RATIO_KEY = "doc-split-ratio";

it("persists keyboard split resizing with the persisted layout key", async () => {
	await browserStorage.setState(SPLIT_RATIO_KEY, "0.45");
	render(
		<ThemeProvider value={darkTheme}>
			<BrowserEditorSidePanelHost
				activePanel="video"
				videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
				onVideoDismiss={() => undefined}
			>
				<div>Editor</div>
			</BrowserEditorSidePanelHost>
		</ThemeProvider>,
	);

	fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowDown" });

	await waitFor(async () =>
		expect(await browserStorage.getState(SPLIT_RATIO_KEY)).toBe("0.5"),
	);
});
