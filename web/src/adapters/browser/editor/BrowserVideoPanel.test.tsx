import { darkTheme } from "@keeper/constants/themes/darkTheme";
import { parseEmbeddedVideoUrl } from "@keeper/components/editor/video/videoUtils";
import { ThemeProvider } from "@react-navigation/native";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { BrowserVideoPanel } from "./BrowserVideoPanel";

afterEach(cleanup);

function renderPanel(url: string) {
	return render(
		<ThemeProvider value={darkTheme}>
			<BrowserVideoPanel url={url} onDismiss={() => undefined} />
		</ThemeProvider>,
	);
}

it("uses canonical parsing and embedded playback", () => {
	expect(parseEmbeddedVideoUrl("https://youtu.be/dQw4w9WgXcQ")?.embedUrl).toBe(
		"https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0",
	);
	renderPanel("https://youtu.be/dQw4w9WgXcQ");
	expect(screen.getByTitle("Youtube video")).toBeInTheDocument();
});

it("shows canonical validation state for persisted unsupported URL", () => {
	expect(parseEmbeddedVideoUrl("https://example.com/video")).toBeNull();
	renderPanel("https://example.com/video");
	expect(screen.getByText("Not a valid YouTube URL")).toBeInTheDocument();
});
