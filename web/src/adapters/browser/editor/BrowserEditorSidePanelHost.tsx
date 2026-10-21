import {
	useCallback,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import { browserStorage } from "@web/services/storage";
import { BrowserVideoPanel } from "./BrowserVideoPanel";

type EditorSidePanel = "video";
const SPLIT_RATIO_KEY = "doc-split-ratio";

import { useMobileViewport } from "@keeper/components/editor/lexical/useMobileEditorViewport";
type Props = {
	activePanel: EditorSidePanel | null;
	videoUrl: string | null;
	children: ReactNode;
	onVideoDismiss: () => void;
};

/** DOM port of EditorSidePanelHost. Keeps source panels in one resizable editor split. */
export function BrowserEditorSidePanelHost({
	activePanel,
	children,
	onVideoDismiss,
	videoUrl,
}: Props) {
	const [ratio, setRatio] = useState(45);
	const ratioRef = useRef(ratio);
	const viewport = useMobileViewport();
	const [videoOverride, setVideoOverride] = useState<{
		limited: boolean;
		url: string | null;
		expanded: boolean;
	} | null>(null);
	const expanded =
		videoOverride?.limited === viewport.limited &&
		videoOverride.url === videoUrl
			? videoOverride.expanded
			: !(viewport.mobile && viewport.limited);
	const minimized = activePanel === "video" && !expanded;
	useEffect(() => {
		if (
			videoOverride &&
			(videoOverride.limited !== viewport.limited ||
				videoOverride.url !== videoUrl)
		)
			setVideoOverride(null);
	}, [videoOverride, viewport.limited, videoUrl]);
	const updateRatio = useCallback(
		(next: number | ((current: number) => number)) => {
			setRatio((current) => {
				const candidate = typeof next === "function" ? next(current) : next;
				const clamped = Math.max(25, Math.min(75, candidate));
				ratioRef.current = clamped;
				return clamped;
			});
		},
		[],
	);
	const persistRatio = useCallback(
		(next = ratioRef.current) =>
			browserStorage.setState(SPLIT_RATIO_KEY, String(next / 100)),
		[],
	);
	useEffect(() => {
		void browserStorage.getState(SPLIT_RATIO_KEY).then((stored) => {
			const ratio = Number.parseFloat(stored ?? "");
			if (Number.isFinite(ratio)) updateRatio(ratio * 100);
		});
	}, [updateRatio]);
	function resize(event: ReactPointerEvent<HTMLElement>) {
		if (
			!activePanel ||
			!event.currentTarget.hasPointerCapture?.(event.pointerId)
		)
			return;
		const bounds = event.currentTarget.getBoundingClientRect();
		const length = bounds.height;
		const offset = event.clientY - bounds.top;
		updateRatio((offset / length) * 100);
	}
	function renderPanel() {
		if (activePanel === "video" && videoUrl)
			return <BrowserVideoPanel url={videoUrl} onDismiss={onVideoDismiss} />;
		return null;
	}
	if (!activePanel)
		return <div className="browser-editor-main">{children}</div>;
	return (
		<div
			className="browser-editor-split browser-editor-split--vertical"
			onPointerMove={resize}
			onPointerUp={(event) => {
				if (event.currentTarget.hasPointerCapture?.(event.pointerId))
					event.currentTarget.releasePointerCapture?.(event.pointerId);
				void persistRatio();
			}}
		>
			{activePanel === "video" ? (
				<button
					type="button"
					className="browser-video-toggle"
					aria-expanded={!minimized}
					onPointerDown={(event) => event.preventDefault()}
					onClick={() =>
						setVideoOverride({
							limited: viewport.limited,
							url: videoUrl,
							expanded: minimized,
						})
					}
				>
					{minimized ? "Expand video" : "Minimize video"}
				</button>
			) : null}
			<aside
				className="browser-editor-panel"
				data-minimized={minimized}
				inert={minimized}
				style={{ flexBasis: `${ratio}%` }}
			>
				{renderPanel()}
			</aside>
			<div
				className="browser-editor-divider"
				role="separator"
				aria-label="Resize editor panel"
				aria-orientation="horizontal"
				tabIndex={0}
				onKeyDown={(event) => {
					const decrease = event.key === "ArrowUp";
					const increase = event.key === "ArrowDown";
					if (!decrease && !increase) return;
					event.preventDefault();
					const next = ratioRef.current + (increase ? 5 : -5);
					updateRatio(next);
					void persistRatio(Math.max(25, Math.min(75, next)));
				}}
				onPointerDown={(event) =>
					event.currentTarget.parentElement?.setPointerCapture(event.pointerId)
				}
			/>
			<div className="browser-editor-pane">{children}</div>
		</div>
	);
}
