import { DraggableBlockPlugin_EXPERIMENTAL } from "@lexical/react/LexicalDraggableBlockPlugin";
import React, { useCallback, useRef, useState } from "react";

export function KeeperDraggableBlockPlugin() {
	const menuRef = useRef<HTMLButtonElement | null>(null);
	const targetLineRef = useRef<HTMLDivElement | null>(null);
	const [anchorElem, setAnchorElem] = useState<HTMLElement | null>(null);

	const isOnMenu = useCallback((element: HTMLElement) => {
		return menuRef.current?.contains(element) ?? false;
	}, []);

	return (
		<>
			<div
				className="keeper-draggable-block-anchor"
				ref={setAnchorElem}
			/>
			{anchorElem ? (
				<DraggableBlockPlugin_EXPERIMENTAL
					anchorElem={anchorElem}
					isOnMenu={isOnMenu}
					menuComponent={
						<button
							aria-label="Drag block"
							className="keeper-draggable-block-handle"
							ref={menuRef}
							type="button"
						>
							<span aria-hidden="true" />
						</button>
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
			) : null}
		</>
	);
}
