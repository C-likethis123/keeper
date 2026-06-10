import { DraggableBlockPlugin_EXPERIMENTAL } from "@lexical/react/LexicalDraggableBlockPlugin";
import React, { useEffect, useRef, useState } from "react";

export function KeeperDraggableBlockPlugin() {
	const menuRef = useRef<HTMLDivElement | null>(null);
	const targetLineRef = useRef<HTMLDivElement | null>(null);
	const [anchorElem, setAnchorElem] = useState<HTMLElement | null>(null);

	useEffect(() => {
		const root = document.querySelector<HTMLElement>(".keeper-editor-content");
		setAnchorElem(root);
	}, []);

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
