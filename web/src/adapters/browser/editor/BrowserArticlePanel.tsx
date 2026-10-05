import { DocumentPanel } from "@keeper/components/editor/document/DocumentPanel";

/** Browser shell for shared article side panel. */
export function BrowserArticlePanel({ url, onDismiss }: { url: string; onDismiss: () => void }) {
	return <DocumentPanel variant="article" url={url} onDismiss={onDismiss} theme="dark" />;
}
