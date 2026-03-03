/// Represents a position within the document.
///
/// A position is defined by the block index and the character offset
/// within that block's content.
export interface DocumentPosition {
	readonly blockIndex: number;
	readonly offset: number;
}

/// Creates a position at the start of the document
export function createStartPosition(): DocumentPosition {
	return { blockIndex: 0, offset: 0 };
}

/// Creates a copy with updated fields
export function copyPosition(
	position: DocumentPosition,
	updates: Partial<DocumentPosition>,
): DocumentPosition {
	return {
		blockIndex: updates.blockIndex ?? position.blockIndex,
		offset: updates.offset ?? position.offset,
	};
}

/// Whether this position is before another position
export function isBefore(
	position: DocumentPosition,
	other: DocumentPosition,
): boolean {
	return comparePositions(position, other) < 0;
}

/// Whether this position is after another position
export function isAfter(
	position: DocumentPosition,
	other: DocumentPosition,
): boolean {
	return comparePositions(position, other) > 0;
}

/// Compares two positions
export function comparePositions(
	a: DocumentPosition,
	b: DocumentPosition,
): number {
	if (a.blockIndex !== b.blockIndex) {
		return a.blockIndex - b.blockIndex;
	}
	return a.offset - b.offset;
}

/// Represents a selection in the document.
///
/// A selection has an anchor (where the selection started) and a focus
/// (where the selection currently ends). If anchor == focus, it's a
/// collapsed selection (cursor).
export interface DocumentSelection {
	readonly anchor: DocumentPosition;
	readonly focus: DocumentPosition;
}

/// Creates a collapsed selection (cursor) at the given position
export function createCollapsedSelection(
	position: DocumentPosition,
): DocumentSelection {
	return {
		anchor: position,
		focus: position,
	};
}

/// Creates a collapsed selection at the start of the document
export function createStartSelection(): DocumentSelection {
	const start = createStartPosition();
	return createCollapsedSelection(start);
}

/// Whether this is a collapsed selection (cursor with no range)
export function isCollapsed(selection: DocumentSelection): boolean {
	return (
		selection.anchor.blockIndex === selection.focus.blockIndex &&
		selection.anchor.offset === selection.focus.offset
	);
}

/// Gets the start position (earlier of anchor/focus)
export function getSelectionStart(
	selection: DocumentSelection,
): DocumentPosition {
	return isBefore(selection.anchor, selection.focus)
		? selection.anchor
		: selection.focus;
}

/// Gets the end position (later of anchor/focus)
export function getSelectionEnd(
	selection: DocumentSelection,
): DocumentPosition {
	return isAfter(selection.anchor, selection.focus)
		? selection.anchor
		: selection.focus;
}

/// Whether the selection is backwards (focus before anchor)
export function isBackward(selection: DocumentSelection): boolean {
	return isBefore(selection.focus, selection.anchor);
}

/// Gets the block index where the selection starts
export function getStartBlockIndex(selection: DocumentSelection): number {
	return getSelectionStart(selection).blockIndex;
}

/// Gets the block index where the selection ends
export function getEndBlockIndex(selection: DocumentSelection): number {
	return getSelectionEnd(selection).blockIndex;
}

/// Whether the selection spans multiple blocks
export function spansMultipleBlocks(selection: DocumentSelection): boolean {
	return getStartBlockIndex(selection) !== getEndBlockIndex(selection);
}

/// Creates a copy with updated fields
export function copySelection(
	selection: DocumentSelection,
	updates: Partial<DocumentSelection>,
): DocumentSelection {
	return {
		anchor: updates.anchor ?? selection.anchor,
		focus: updates.focus ?? selection.focus,
	};
}

/// Creates a collapsed selection at the focus position
export function collapseSelection(
	selection: DocumentSelection,
	toStart = false,
): DocumentSelection {
	const position = toStart
		? getSelectionStart(selection)
		: getSelectionEnd(selection);
	return createCollapsedSelection(position);
}

/// Extends the selection to a new focus position
export function extendSelection(
	selection: DocumentSelection,
	newFocus: DocumentPosition,
): DocumentSelection {
	return copySelection(selection, { focus: newFocus });
}
