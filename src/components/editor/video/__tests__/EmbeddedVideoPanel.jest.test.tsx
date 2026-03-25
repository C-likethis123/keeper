import { EmbeddedVideoPanel } from "@/components/editor/video/EmbeddedVideoPanel";
import type { EmbeddedVideoSource } from "@/components/editor/video/videoUtils";
import { render, screen, fireEvent } from "@testing-library/react-native";

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
    MaterialIcons: ({ name }: { name: string }) =>
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
    "https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&enablejsapi=1",
  host: "youtube.com",
  label: "YouTube video",
  kind: "youtube",
};

it("renders the video label", () => {
  render(
    <EmbeddedVideoPanel
      layout="stacked"
      onClose={() => {}}
      source={youtubeSource}
    />,
  );
  expect(screen.getByText("YouTube video")).toBeTruthy();
});

it("calls onClose when the close button is pressed", () => {
  const onClose = jest.fn();
  render(
    <EmbeddedVideoPanel
      layout="stacked"
      onClose={onClose}
      source={youtubeSource}
    />,
  );
  fireEvent.press(screen.getByLabelText("Close video panel"));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("shows resize buttons only in side layout", () => {
  const { rerender } = render(
    <EmbeddedVideoPanel
      layout="side"
      onClose={() => {}}
      source={youtubeSource}
    />,
  );
  expect(screen.getByLabelText("Shrink video panel")).toBeTruthy();
  expect(screen.getByLabelText("Expand video panel")).toBeTruthy();

  rerender(
    <EmbeddedVideoPanel
      layout="stacked"
      onClose={() => {}}
      source={youtubeSource}
    />,
  );
  expect(screen.queryByLabelText("Shrink video panel")).toBeNull();
  expect(screen.queryByLabelText("Expand video panel")).toBeNull();
});
