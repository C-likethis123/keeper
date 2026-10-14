import { BrowserWebPanel } from "./BrowserWebPanel";

/** Browser shell for shared article side panel. */
export function BrowserArticlePanel({ url, onDismiss }: { url: string | null; onDismiss: () => void }) {
	return <BrowserWebPanel key={url} initialUrl={url} onDismiss={onDismiss} />;
}
