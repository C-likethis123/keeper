import type { ViewStyle } from "react-native";
import { parseEmbeddedVideoUrl } from "./videoUtils";
import { EmbeddedVideoPanel } from "./EmbeddedVideoPanel";

interface VideoSplitPanelProps {
  url: string;
  onDismiss: () => void;
  style?: ViewStyle;
}

export default function VideoSplitPanel({
  url,
  onDismiss,
  style,
}: VideoSplitPanelProps) {
  const source = parseEmbeddedVideoUrl(url);
  if (!source) {
    return null;
  }
  // TODO: add a dismiss button
  return <EmbeddedVideoPanel source={source} />;
}
