import { DraggableBlockPlugin_EXPERIMENTAL } from "@lexical/react/LexicalDraggableBlockPlugin";
import { useRef } from "react";

interface KeeperDraggableBlockPluginProps {
	anchorElem: HTMLElement | null;
}

export function KeeperDraggableBlockPlugin({
	anchorElem,
}: KeeperDraggableBlockPluginProps) {
	const menuRef = useRef<HTMLDivElement | null>(null);
	const targetLineRef = useRef<HTMLDivElement | null>(null);

	if (!anchorElem) {
		return null;
	}

	return (
		<DraggableBlockPlugin_EXPERIMENTAL
			anchorElem={anchorElem}
			isOnMenu={(element) => menuRef.current?.contains(element) ?? false}
			menuComponent={
				<div
					aria-hidden="true"
					className="keeper-draggable-block-handle"
					ref={menuRef}
				>
					<span />
				</div>
			}
			menuRef={menuRef}
			targetLineComponent={
				<div
					className="keeper-draggable-block-target-line"
					ref={targetLineRef}
				/>
			}
			targetLineRef={targetLineRef}
		/>
	);
}
