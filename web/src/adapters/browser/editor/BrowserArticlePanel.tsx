import { DocumentPanel } from "@keeper/components/editor/document/DocumentPanel.web";

/** Browser shell for canonical Expo article side panel. */
export function BrowserArticlePanel({ url, onDismiss }: { url: string; onDismiss: () => void }) {
	return <DocumentPanel variant="article" url={url} onDismiss={onDismiss} theme="dark" />;
}
