import { vi } from "vitest";
import { EmbeddedVideoPanel } from "@/components/editor/video/EmbeddedVideoPanel";
import type { EmbeddedVideoSource } from "@/components/editor/video/videoUtils";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/shared/Icons", async () => {
	const React = await import("react");
	return {
		FontAwesome: ({ name }: { name: string }) =>
			React.createElement("span", null, name),
	};
});

vi.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			background: "#fff",
			border: "#ccc",
			card: "#f9f9f9",
			text: "#111",
			textMuted: "#888",
		},
		custom: { editor: { placeholder: "#aaa" } },
	}),
}));

const youtubeSource: EmbeddedVideoSource = {
	rawUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0",
	host: "youtube.com",
};

describe("EmbeddedVideoPanel", () => {
	it("renders the video panel with a YouTube source", () => {
		const { container } = render(<EmbeddedVideoPanel source={youtubeSource} />);
		expect(screen.getByTestId("embedded-video-panel")).toBeTruthy();
		expect(container.querySelector("iframe")).toBeTruthy();
	});

	it("displays the video raw URL as caption", () => {
		render(<EmbeddedVideoPanel source={youtubeSource} />);
		expect(screen.getByText(youtubeSource.rawUrl)).toBeTruthy();
	});

	it("renders the video inside an iframe", () => {
		const { container } = render(<EmbeddedVideoPanel source={youtubeSource} />);
		expect(container.querySelector("iframe")?.srcdoc).toContain(
			"https://www.youtube.com/embed/dQw4w9WgXcQ",
		);
	});
});
