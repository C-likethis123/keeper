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
	type LexicalEditor,
	type LexicalNode,
	type NodeKey,
	defineExtension,
} from "lexical";

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

	for (const cell of getCells(firstRow)) {
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

		if (inExpandedBounds) {
			return getColumnHitTarget(table, x, y) ?? getRowHitTarget(table, x, y);
		}
	}

	return null;
}

function getControlsState(
	editor: LexicalEditor,
	target: TableHitTarget | null,
	contentElement: Element,
): TableControlsState | null {
	if (!target) {
		return null;
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
		return null;
	}

	return {
		cellKey,
		insertAfter: target.insertAfter,
		left: target.left - contentRect.left + contentElement.scrollLeft,
		mode: target.mode,
		top: target.top - contentRect.top + contentElement.scrollTop,
	};
}

function createTableControlElement(
	editor: LexicalEditor,
	hideControls: () => void,
) {
	const controlElement = document.createElement("div");
	const insertButton = document.createElement("button");
	const deleteButton = document.createElement("button");

	controlElement.className = "keeper-table-control";
	controlElement.style.display = "none";

	insertButton.className = "keeper-table-control-button";
	insertButton.type = "button";
	insertButton.textContent = "+";

	deleteButton.className =
		"keeper-table-control-button keeper-table-control-delete";
	deleteButton.type = "button";
	deleteButton.textContent = "-";

	controlElement.append(insertButton, deleteButton);

	let controls: TableControlsState | null = null;

	const preventMouseDown = (event: MouseEvent) => event.preventDefault();
	const runAction = (action: "delete" | "insert") => {
		if (!controls) {
			return;
		}
		const { cellKey, insertAfter, mode } = controls;
		editor.update(() => {
			const cellNode = $getNodeByKey(cellKey);
			if (!$isTableCellNode(cellNode)) {
				return;
			}
			cellNode.selectEnd();
			if (mode === "column") {
				if (action === "insert") {
					$insertTableColumnAtSelection(insertAfter);
				} else {
					$deleteTableColumnAtSelection();
				}
				return;
			}
			if (action === "insert") {
				$insertTableRowAtSelection(insertAfter);
			} else {
				$deleteTableRowAtSelection();
			}
		});
		hideControls();
	};

	insertButton.addEventListener("mousedown", preventMouseDown);
	deleteButton.addEventListener("mousedown", preventMouseDown);
	insertButton.addEventListener("click", () => runAction("insert"));
	deleteButton.addEventListener("click", () => runAction("delete"));

	return {
		element: controlElement,
		hide() {
			controls = null;
			controlElement.style.display = "none";
		},
		setControls(nextControls: TableControlsState | null) {
			controls = nextControls;
			if (!controls) {
				controlElement.style.display = "none";
				return;
			}

			const targetName = controls.mode === "column" ? "column" : "row";
			controlElement.className = `keeper-table-control keeper-table-control-${controls.mode}`;
			controlElement.style.display = "block";
			controlElement.style.left = `${controls.left}px`;
			controlElement.style.top = `${controls.top}px`;
			insertButton.ariaLabel = `Add table ${targetName}`;
			deleteButton.ariaLabel = `Delete table ${targetName}`;
		},
	};
}

export const KeeperTableControlsExtension = defineExtension({
	name: "keeper/TableControls",
	register(editor) {
		let cleanup: (() => void) | undefined;

		const attach = (rootElement: HTMLElement, contentElement: HTMLElement) => {
			const controls = createTableControlElement(editor, () => controls.hide());

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
				controls.setControls(
					getControlsState(
						editor,
						findTableHitTarget(contentElement, event.clientX, event.clientY),
						contentElement,
					),
				);
			};
			const hideControls = () => controls.hide();
			const unregisterUpdateListener = editor.registerUpdateListener(hideControls);

			contentElement.append(controls.element);
			rootElement.addEventListener("pointermove", handleTableHover);
			rootElement.addEventListener("pointerover", handleTableHover);
			rootElement.addEventListener("mousemove", handleTableHover);
			rootElement.addEventListener("mouseover", handleTableHover);
			contentElement.addEventListener("pointermove", handleTableHover);
			contentElement.addEventListener("pointerover", handleTableHover);
			contentElement.addEventListener("mousemove", handleTableHover);
			contentElement.addEventListener("mouseover", handleTableHover);
			window.addEventListener("resize", hideControls);
			window.addEventListener("scroll", hideControls, true);

			return () => {
				rootElement.removeEventListener("pointermove", handleTableHover);
				rootElement.removeEventListener("pointerover", handleTableHover);
				rootElement.removeEventListener("mousemove", handleTableHover);
				rootElement.removeEventListener("mouseover", handleTableHover);
				contentElement.removeEventListener("pointermove", handleTableHover);
				contentElement.removeEventListener("pointerover", handleTableHover);
				contentElement.removeEventListener("mousemove", handleTableHover);
				contentElement.removeEventListener("mouseover", handleTableHover);
				window.removeEventListener("resize", hideControls);
				window.removeEventListener("scroll", hideControls, true);
				unregisterUpdateListener();
				controls.element.remove();
			};
		};

		const attachToRoot = (rootElement: HTMLElement | null) => {
			cleanup?.();
			cleanup = undefined;

			const contentElement =
				rootElement?.closest<HTMLElement>(".keeper-editor-content") ?? null;
			if (rootElement && contentElement) {
				cleanup = attach(rootElement, contentElement);
			}
		};

		attachToRoot(editor.getRootElement());
		const unregisterRootListener = editor.registerRootListener(attachToRoot);

		return () => {
			unregisterRootListener();
			cleanup?.();
		};
	},
});
