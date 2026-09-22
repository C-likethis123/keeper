import {
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	useEffect,
	useState,
} from "react";
import { BrowserArticlePanel } from "./BrowserArticlePanel";
import { BrowserDocumentPanel } from "./BrowserDocumentPanel";
import { BrowserVideoPanel } from "./BrowserVideoPanel";

type EditorSidePanel = "document" | "video" | "article";

type Props = {
	activePanel: EditorSidePanel | null;
	articleUrl: string | null;
	attachmentPath: string | null;
	noteId: string;
	videoUrl: string | null;
	children: ReactNode;
	onArticleDismiss: () => void;
	onAttachmentDismiss: () => void;
	onDocumentPositionChange: (path: string, position: string) => void;
	onTextSelected: (text: string) => void;
	onVideoDismiss: () => void;
};

/** DOM port of EditorSidePanelHost. Keeps source panels in one resizable editor split. */
export function BrowserEditorSidePanelHost({
	activePanel,
	articleUrl,
	attachmentPath,
	children,
	noteId,
	onArticleDismiss,
	onAttachmentDismiss,
	onDocumentPositionChange,
	onTextSelected,
	onVideoDismiss,
	videoUrl,
}: Props) {
	const [ratio, setRatio] = useState(45);
	const [isNarrow, setIsNarrow] = useState(false);
	useEffect(() => {
		if (!window.matchMedia) return;
		const media = window.matchMedia("(max-width: 48rem)");
		const update = () => setIsNarrow(media.matches);
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);
	const vertical = activePanel === "video" || isNarrow;
	function resize(event: ReactPointerEvent<HTMLElement>) {
		if (!activePanel || !event.currentTarget.hasPointerCapture(event.pointerId))
			return;
		const bounds = event.currentTarget.getBoundingClientRect();
		const length = vertical ? bounds.height : bounds.width;
		const offset = vertical
			? event.clientY - bounds.top
			: event.clientX - bounds.left;
		setRatio(Math.max(25, Math.min(75, (offset / length) * 100)));
	}
	function renderPanel() {
		if (activePanel === "article" && articleUrl)
			return (
				<BrowserArticlePanel url={articleUrl} onDismiss={onArticleDismiss} />
			);
		if (activePanel === "video" && videoUrl)
			return <BrowserVideoPanel url={videoUrl} onDismiss={onVideoDismiss} />;
		if (activePanel === "document" && attachmentPath)
			return (
				<BrowserDocumentPanel
					attachmentPath={attachmentPath}
					noteId={noteId}
					onDismiss={onAttachmentDismiss}
					onPositionChange={onDocumentPositionChange}
					onTextSelected={onTextSelected}
				/>
			);
		return null;
	}
	if (!activePanel)
		return <div className="browser-editor-main">{children}</div>;
	return (
		<div
			className={`browser-editor-split browser-editor-split--${vertical ? "vertical" : "horizontal"}`}
			onPointerMove={resize}
			onPointerUp={(event) => {
				if (event.currentTarget.hasPointerCapture(event.pointerId))
					event.currentTarget.releasePointerCapture(event.pointerId);
			}}
		>
			<aside
				className="browser-editor-panel"
				style={{ flexBasis: `${ratio}%` }}
			>
				{renderPanel()}
			</aside>
			<div
				className="browser-editor-divider"
				role="separator"
				aria-label="Resize editor panel"
				aria-orientation={vertical ? "horizontal" : "vertical"}
				tabIndex={0}
				onKeyDown={(event) => {
					const decrease = vertical
						? event.key === "ArrowUp"
						: event.key === "ArrowLeft";
					const increase = vertical
						? event.key === "ArrowDown"
						: event.key === "ArrowRight";
					if (!decrease && !increase) return;
					event.preventDefault();
					setRatio((current) =>
						Math.max(25, Math.min(75, current + (increase ? 5 : -5))),
					);
				}}
				onPointerDown={(event) =>
					event.currentTarget.parentElement?.setPointerCapture(event.pointerId)
				}
			/>
			<div className="browser-editor-pane">{children}</div>
		</div>
	);
}
