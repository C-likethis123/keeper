import VideoSplitPanel from "@keeper/components/editor/video/VideoSplitPanel";

/** Browser shell for the same parsed, sandboxed video panel as Expo. */
export function BrowserVideoPanel({ url, onDismiss }: { url: string; onDismiss: () => void }) {
	return <VideoSplitPanel url={url} onDismiss={onDismiss} />;
}
