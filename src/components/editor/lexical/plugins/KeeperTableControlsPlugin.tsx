import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
	$deleteTableColumnAtSelection,
	$deleteTableRowAtSelection,
	$insertTableColumnAtSelection,
	$insertTableRowAtSelection,
	$isTableCellNode,
	$isTableNode,
} from "@lexical/table";
import {
	$getNearestNodeFromDOMNode,
	$getNodeByKey,
	type LexicalNode,
	type NodeKey,
} from "lexical";
import React, { useCallback, useEffect, useState } from "react";

type TableControlsState = {
	cellKey: NodeKey;
	insertAfter: boolean;
	left: number;
	mode: "column" | "row";
	top: number;
};

type TableHitTarget = {
	cellElement: HTMLTableCellElement;
	insertAfter: boolean;
	left: number;
	mode: "column" | "row";
	tableElement: HTMLTableElement;
	top: number;
};

const EDGE_HIT_SIZE = 14;
const CONTROL_OFFSET = 8;

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

function getCells(row: HTMLTableRowElement) {
	return Array.from(row.cells).filter(
		(cell): cell is HTMLTableCellElement => cell instanceof HTMLTableCellElement,
	);
}

function getColumnHitTarget(
	tableElement: HTMLTableElement,
	x: number,
	y: number,
): TableHitTarget | null {
	const tableRect = tableElement.getBoundingClientRect();
	const atTableTopEdge = Math.abs(y - tableRect.top) <= EDGE_HIT_SIZE;
	const atTableBottomEdge = Math.abs(y - tableRect.bottom) <= EDGE_HIT_SIZE;
	if (!atTableTopEdge && !atTableBottomEdge) {
		return null;
	}
	const controlTop = atTableTopEdge
		? tableRect.top - CONTROL_OFFSET
		: tableRect.bottom + CONTROL_OFFSET;

	const firstRow = tableElement.rows.item(0);
	if (!firstRow) {
		return null;
	}

	const cells = getCells(firstRow);
	for (let index = 0; index < cells.length; index += 1) {
		const cell = cells[index];
		const rect = cell.getBoundingClientRect();
		const atLeftEdge = Math.abs(x - rect.left) <= EDGE_HIT_SIZE;
		const atRightEdge = Math.abs(x - rect.right) <= EDGE_HIT_SIZE;

		if (atLeftEdge) {
			return {
				cellElement: cell,
				insertAfter: false,
				left: rect.left,
				mode: "column",
				tableElement,
				top: controlTop,
			};
		}
		if (atRightEdge) {
			return {
				cellElement: cell,
				insertAfter: true,
				left: rect.right,
				mode: "column",
				tableElement,
				top: controlTop,
			};
		}
	}

	return null;
}

function getRowHitTarget(
	tableElement: HTMLTableElement,
	x: number,
	y: number,
): TableHitTarget | null {
	const tableRect = tableElement.getBoundingClientRect();
	const atTableLeftEdge = Math.abs(x - tableRect.left) <= EDGE_HIT_SIZE;
	const atTableRightEdge = Math.abs(x - tableRect.right) <= EDGE_HIT_SIZE;
	if (!atTableLeftEdge && !atTableRightEdge) {
		return null;
	}
	const controlLeft = atTableLeftEdge
		? tableRect.left - CONTROL_OFFSET
		: tableRect.right + CONTROL_OFFSET;

	for (const row of Array.from(tableElement.rows)) {
		const firstCell = row.cells.item(0);
		if (!(firstCell instanceof HTMLTableCellElement)) {
			continue;
		}

		const rect = row.getBoundingClientRect();
		const atTopEdge = Math.abs(y - rect.top) <= EDGE_HIT_SIZE;
		const atBottomEdge = Math.abs(y - rect.bottom) <= EDGE_HIT_SIZE;

		if (atTopEdge) {
			return {
				cellElement: firstCell,
				insertAfter: false,
				left: controlLeft,
				mode: "row",
				tableElement,
				top: rect.top,
			};
		}
		if (atBottomEdge) {
			return {
				cellElement: firstCell,
				insertAfter: true,
				left: controlLeft,
				mode: "row",
				tableElement,
				top: rect.bottom,
			};
		}
	}

	return null;
}

function findTableHitTarget(
	contentElement: Element,
	x: number,
	y: number,
): TableHitTarget | null {
	const tables = Array.from(
		contentElement.querySelectorAll("table.keeper-table"),
	).filter(
		(table): table is HTMLTableElement => table instanceof HTMLTableElement,
	);

	for (const table of tables) {
		const rect = table.getBoundingClientRect();
		const inExpandedBounds =
			x >= rect.left - EDGE_HIT_SIZE &&
			x <= rect.right + EDGE_HIT_SIZE &&
			y >= rect.top - EDGE_HIT_SIZE &&
			y <= rect.bottom + EDGE_HIT_SIZE;

		if (!inExpandedBounds) {
			continue;
		}

		return getColumnHitTarget(table, x, y) ?? getRowHitTarget(table, x, y);
	}

	return null;
}

export function KeeperTableControlsPlugin() {
	const [editor] = useLexicalComposerContext();
	const [controls, setControls] = useState<TableControlsState | null>(null);

	const updateControls = useCallback(
		(target: TableHitTarget | null, contentElement: Element) => {
			if (!target) {
				setControls(null);
				return;
			}

			const contentRect = contentElement.getBoundingClientRect();
			let cellKey: NodeKey | null = null;
			let hasTableNode = false;

			editor.read(() => {
				const cellNode = $getNearestNodeFromDOMNode(target.cellElement);
				const tableNode =
					getNearestTableNode($getNearestNodeFromDOMNode(target.tableElement)) ??
					getNearestTableNode(cellNode);

				if (cellNode && tableNode) {
					cellKey = cellNode.getKey();
					hasTableNode = true;
				}
			});

			if (!cellKey || !hasTableNode) {
				setControls(null);
				return;
			}

			setControls({
				cellKey,
				insertAfter: target.insertAfter,
				left: target.left - contentRect.left + contentElement.scrollLeft,
				mode: target.mode,
				top: target.top - contentRect.top + contentElement.scrollTop,
			});
		},
		[editor],
	);

	useEffect(() => {
		const rootElement = editor.getRootElement();
		const contentElement = rootElement?.closest(".keeper-editor-content");
		if (!rootElement || !contentElement) {
			return;
		}

		const handleTableHover: EventListener = (event) => {
			if (!(event instanceof MouseEvent)) {
				return;
			}
			if (
				event.target instanceof HTMLElement &&
				event.target.closest(".keeper-table-control")
			) {
				return;
			}
			updateControls(
				findTableHitTarget(contentElement, event.clientX, event.clientY),
				contentElement,
			);
		};
		const handleScroll = () => setControls(null);
		const unregisterUpdateListener = editor.registerUpdateListener(() => {
			setControls(null);
		});

		rootElement.addEventListener("pointermove", handleTableHover);
		rootElement.addEventListener("pointerover", handleTableHover);
		rootElement.addEventListener("mousemove", handleTableHover);
		rootElement.addEventListener("mouseover", handleTableHover);
		contentElement.addEventListener("pointermove", handleTableHover);
		contentElement.addEventListener("pointerover", handleTableHover);
		contentElement.addEventListener("mousemove", handleTableHover);
		contentElement.addEventListener("mouseover", handleTableHover);
		window.addEventListener("resize", handleScroll);
		window.addEventListener("scroll", handleScroll, true);
		return () => {
			rootElement.removeEventListener("pointermove", handleTableHover);
			rootElement.removeEventListener("pointerover", handleTableHover);
			rootElement.removeEventListener("mousemove", handleTableHover);
			rootElement.removeEventListener("mouseover", handleTableHover);
			contentElement.removeEventListener("pointermove", handleTableHover);
			contentElement.removeEventListener("pointerover", handleTableHover);
			contentElement.removeEventListener("mousemove", handleTableHover);
			contentElement.removeEventListener("mouseover", handleTableHover);
			window.removeEventListener("resize", handleScroll);
			window.removeEventListener("scroll", handleScroll, true);
			unregisterUpdateListener();
		};
	}, [editor, updateControls]);

	const insertRow = useCallback(() => {
		if (!controls || controls.mode !== "row") {
			return;
		}
		editor.update(() => {
			const cellNode = $getNodeByKey(controls.cellKey);
			if (!$isTableCellNode(cellNode)) {
				return;
			}
			cellNode.selectEnd();
			$insertTableRowAtSelection(controls.insertAfter);
		});
		setControls(null);
	}, [controls, editor]);

	const insertColumn = useCallback(() => {
		if (!controls || controls.mode !== "column") {
			return;
		}
		editor.update(() => {
			const cellNode = $getNodeByKey(controls.cellKey);
			if (!$isTableCellNode(cellNode)) {
				return;
			}
			cellNode.selectEnd();
			$insertTableColumnAtSelection(controls.insertAfter);
		});
		setControls(null);
	}, [controls, editor]);

	const deleteRow = useCallback(() => {
		if (!controls || controls.mode !== "row") {
			return;
		}
		editor.update(() => {
			const cellNode = $getNodeByKey(controls.cellKey);
			if (!$isTableCellNode(cellNode)) {
				return;
			}
			cellNode.selectEnd();
			$deleteTableRowAtSelection();
		});
		setControls(null);
	}, [controls, editor]);

	const deleteColumn = useCallback(() => {
		if (!controls || controls.mode !== "column") {
			return;
		}
		editor.update(() => {
			const cellNode = $getNodeByKey(controls.cellKey);
			if (!$isTableCellNode(cellNode)) {
				return;
			}
			cellNode.selectEnd();
			$deleteTableColumnAtSelection();
		});
		setControls(null);
	}, [controls, editor]);

	if (!controls) {
		return null;
	}

	const insertAction = controls.mode === "column" ? insertColumn : insertRow;
	const deleteAction = controls.mode === "column" ? deleteColumn : deleteRow;
	const targetName = controls.mode === "column" ? "column" : "row";

	return (
		<div
			className={`keeper-table-control keeper-table-control-${controls.mode}`}
			style={{
				left: controls.left,
				top: controls.top,
			}}
		>
			<button
				aria-label={`Add table ${targetName}`}
				className="keeper-table-control-button"
				onMouseDown={(event) => event.preventDefault()}
				onClick={insertAction}
				type="button"
			>
				+
			</button>
			<button
				aria-label={`Delete table ${targetName}`}
				className="keeper-table-control-button keeper-table-control-delete"
				onMouseDown={(event) => event.preventDefault()}
				onClick={deleteAction}
				type="button"
			>
				-
			</button>
		</div>
	);
}
