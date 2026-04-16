import { EmbeddedVideoPanel } from "@/components/editor/video/EmbeddedVideoPanel";
import type { EmbeddedVideoSource } from "@/components/editor/video/videoUtils";
import { render, screen } from "@testing-library/react-native";

jest.mock("react-native-webview", () => {
	const React = require("react");
	const { View } = require("react-native");
	return {
		WebView: ({ testID }: { testID?: string }) =>
			React.createElement(View, { testID: testID ?? "webview" }),
	};
});

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
	embedUrl:
		"https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&enablejsapi=1",
	host: "youtube.com",
};

it("renders the video panel with a YouTube source", () => {
	render(<EmbeddedVideoPanel source={youtubeSource} />);
	expect(screen.getByTestId("embedded-video-panel")).toBeTruthy();
	expect(screen.getByTestId("webview")).toBeTruthy();
});

it("displays the video raw URL as caption", () => {
	render(<EmbeddedVideoPanel source={youtubeSource} />);
	expect(screen.getByText(youtubeSource.rawUrl)).toBeTruthy();
});
