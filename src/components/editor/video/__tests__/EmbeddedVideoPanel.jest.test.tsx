import { EmbeddedVideoPanel } from "@/components/editor/video/EmbeddedVideoPanel";
import type { EmbeddedVideoSource } from "@/components/editor/video/videoUtils";
import { render, screen } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		FontAwesome: ({ name }: { name: string }) =>
			React.createElement(Text, null, name),
	};
});

jest.mock("@/hooks/useExtendedTheme", () => ({
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
	const originalLocation = window.location;

	beforeAll(() => {
		// @ts-ignore
		window.location = {
			origin: "https://keeper.app",
			protocol: "https:",
		};
	});

	afterAll(() => {
		// @ts-expect-error restoring mocked location
		window.location = originalLocation;
	});

	it("renders the video panel with a YouTube source", () => {
		const { UNSAFE_getByType } = render(
			<EmbeddedVideoPanel source={youtubeSource} />,
		);
		expect(screen.getByTestId("embedded-video-panel")).toBeTruthy();
		expect(UNSAFE_getByType("iframe")).toBeTruthy();
	});

	it("displays the video raw URL as caption", () => {
		render(<EmbeddedVideoPanel source={youtubeSource} />);
		expect(screen.getByText(youtubeSource.rawUrl)).toBeTruthy();
	});

	it("renders the video inside an iframe", () => {
		const { UNSAFE_getByType } = render(
			<EmbeddedVideoPanel source={youtubeSource} />,
		);
		expect(UNSAFE_getByType("iframe").props.srcDoc).toContain(
		"https://www.youtube.com/embed/dQw4w9WgXcQ",
	);
	});
});
