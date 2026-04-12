import { EmbeddedVideoPanel } from "@/components/editor/video/EmbeddedVideoPanel";
import type { EmbeddedVideoSource } from "@/components/editor/video/videoUtils";
import { fireEvent, render, screen } from "@testing-library/react-native";

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

it("calls onToggleMode when the minimize/expand button is pressed", () => {
	const onToggleMode = jest.fn();
	const { rerender } = render(
		<EmbeddedVideoPanel
			onToggleMode={onToggleMode}
			source={youtubeSource}
			mode="normal"
		/>,
	);
	fireEvent.press(screen.getByLabelText("Minimize video panel"));
	expect(onToggleMode).toHaveBeenCalledTimes(1);

	rerender(
		<EmbeddedVideoPanel
			onToggleMode={onToggleMode}
			source={youtubeSource}
			mode="minimised"
		/>,
	);
	fireEvent.press(screen.getByLabelText("Expand video panel"));
	expect(onToggleMode).toHaveBeenCalledTimes(2);
});

it("hides player frame in minimised mode", () => {
	const { rerender } = render(
		<EmbeddedVideoPanel
			source={youtubeSource}
			onToggleMode={() => {}}
			mode="normal"
		/>,
	);
	expect(screen.getByTestId("webview")).toBeTruthy();

	rerender(
		<EmbeddedVideoPanel
			onToggleMode={() => {}}
			source={youtubeSource}
			mode="minimised"
		/>,
	);
	expect(screen.queryByTestId("webview")).toBeNull();
});
