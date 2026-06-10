import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
	$insertTableColumnAtSelection,
	$insertTableRowAtSelection,
	$isTableCellNode,
	$isTableNode,
	$isTableRowNode,
} from "@lexical/table";
import {
	$getNearestNodeFromDOMNode,
	$getNodeByKey,
	type LexicalNode,
} from "lexical";
import React, { useCallback, useEffect, useState } from "react";

type TableControlsState = {
	height: number;
	left: number;
	tableKey: string;
	top: number;
	width: number;
};

type TableTarget = {
	nodeTarget: HTMLElement;
	tableElement: HTMLTableElement;
};

function getTableTarget(target: EventTarget | null): TableTarget | null {
	if (!(target instanceof HTMLElement)) {
		return null;
	}
	const tableElement = target.closest("table.keeper-table");
	if (!(tableElement instanceof HTMLTableElement)) {
		return null;
	}
	return { nodeTarget: target, tableElement };
}

function getNearestTableNode(node: LexicalNode | null): LexicalNode | null {
	let current: LexicalNode | null = node;
	while (current) {
		if ($isTableNode(current)) {
			return current;
		}
		current = current.getParent();
	}
	return null;
}

export function KeeperTableControlsPlugin() {
	const [editor] = useLexicalComposerContext();
	const [controls, setControls] = useState<TableControlsState | null>(null);

	const updateControls = useCallback(
		(target: TableTarget | null) => {
			if (!target) {
				setControls(null);
				return;
			}

			const rootElement = editor.getRootElement();
			const contentElement = rootElement?.closest(".keeper-editor-content");
			if (!contentElement) {
				setControls(null);
				return;
			}

			let tableKey: string | null = null;
			editor.getEditorState().read(() => {
				const tableNode = getNearestTableNode(
					$getNearestNodeFromDOMNode(target.nodeTarget),
				);
				if (tableNode) {
					tableKey = tableNode.getKey();
				}
			});
			if (!tableKey) {
				setControls(null);
				return;
			}

			const tableRect = target.tableElement.getBoundingClientRect();
			const contentRect = contentElement.getBoundingClientRect();
			setControls({
				height: tableRect.height,
				left: tableRect.left - contentRect.left + contentElement.scrollLeft,
				tableKey,
				top: tableRect.top - contentRect.top + contentElement.scrollTop,
				width: tableRect.width,
			});
		},
		[editor],
	);

	useEffect(() => {
		const rootElement = editor.getRootElement();
		if (!rootElement) {
			return;
		}

		const handlePointerMove = (event: PointerEvent) => {
			if (
				event.target instanceof HTMLElement &&
				event.target.closest(".keeper-table-control")
			) {
				return;
			}
			updateControls(getTableTarget(event.target));
		};
		const handleFocusIn = (event: FocusEvent) => {
			updateControls(getTableTarget(event.target));
		};
		const handleScroll = () => {
			const tableElement =
				controls && editor.getElementByKey(controls.tableKey);
			updateControls(
				tableElement instanceof HTMLTableElement
					? { nodeTarget: tableElement, tableElement }
					: null,
			);
		};
		const unregisterUpdateListener = editor.registerUpdateListener(() => {
			const tableElement = controls
				? editor.getElementByKey(controls.tableKey)
				: null;
			updateControls(
				tableElement instanceof HTMLTableElement
					? { nodeTarget: tableElement, tableElement }
					: null,
			);
		});

		rootElement.addEventListener("pointermove", handlePointerMove);
		rootElement.addEventListener("focusin", handleFocusIn);
		window.addEventListener("resize", handleScroll);
		window.addEventListener("scroll", handleScroll, true);
		return () => {
			rootElement.removeEventListener("pointermove", handlePointerMove);
			rootElement.removeEventListener("focusin", handleFocusIn);
			window.removeEventListener("resize", handleScroll);
			window.removeEventListener("scroll", handleScroll, true);
			unregisterUpdateListener();
		};
	}, [controls, editor, updateControls]);

	const insertRow = useCallback(() => {
		if (!controls) {
			return;
		}
		editor.update(() => {
			const tableNode = $getNodeByKey(controls.tableKey);
			if (!$isTableNode(tableNode)) {
				return;
			}
			const rows = tableNode.getChildren().filter($isTableRowNode);
			const lastRow = rows.at(-1);
			const firstCell = lastRow?.getChildren().find($isTableCellNode);
			if (!firstCell) {
				return;
			}
			firstCell.selectEnd();
			$insertTableRowAtSelection(true);
		});
	}, [controls, editor]);

	const insertColumn = useCallback(() => {
		if (!controls) {
			return;
		}
		editor.update(() => {
			const tableNode = $getNodeByKey(controls.tableKey);
			if (!$isTableNode(tableNode)) {
				return;
			}
			const firstRow = tableNode.getChildren().find($isTableRowNode);
			const cells = firstRow?.getChildren().filter($isTableCellNode) ?? [];
			const lastCell = cells.at(-1);
			if (!lastCell) {
				return;
			}
			lastCell.selectEnd();
			$insertTableColumnAtSelection(true);
		});
	}, [controls, editor]);

	if (!controls) {
		return null;
	}

	return (
		<>
			<button
				aria-label="Add table column"
				className="keeper-table-control keeper-table-control-column"
				onMouseDown={(event) => event.preventDefault()}
				onClick={insertColumn}
				style={{
					left: controls.left + controls.width,
					top: controls.top - 28,
				}}
				type="button"
			>
				+
			</button>
			<button
				aria-label="Add table row"
				className="keeper-table-control keeper-table-control-row"
				onMouseDown={(event) => event.preventDefault()}
				onClick={insertRow}
				style={{
					left: controls.left - 42,
					top: controls.top + controls.height,
				}}
				type="button"
			>
				+
			</button>
		</>
	);
}
