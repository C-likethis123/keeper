import { BlockType } from "@/components/editor/core/BlockNode";
import type { Document } from "@/components/editor/core/Document";
import type { DocumentSelection } from "@/components/editor/core/Selection";

export type VerticalDirection = "up" | "down";

interface VerticalNavigationOptions {
	direction: VerticalDirection;
	document: Document;
	blockIndex: number;
	selection: DocumentSelection | null;
}

interface NavigationTarget {
	blockIndex: number;
	offset: number;
}

function getLineInfo(content: string, offset: number) {
	const clampedOffset = Math.max(0, Math.min(offset, content.length));
	const beforeCursor = content.slice(0, clampedOffset);
	const linesBeforeCursor = beforeCursor.split("\n");
	const currentLineIndex = linesBeforeCursor.length - 1;
	const lineStart = beforeCursor.lastIndexOf("\n") + 1;
	const column = clampedOffset - lineStart;
	const totalLines = content.split("\n").length;

	return {
		column,
		isFirstLine: currentLineIndex === 0,
		isLastLine: currentLineIndex === totalLines - 1,
	};
}

function getOffsetForColumn(
	content: string,
	direction: VerticalDirection,
	column: number,
) {
	if (content.length === 0) return 0;

	const lines = content.split("\n");
	const targetLineIndex = direction === "up" ? lines.length - 1 : 0;
	let offset = 0;

	for (let index = 0; index < targetLineIndex; index += 1) {
		offset += lines[index].length + 1;
	}

	return offset + Math.min(column, lines[targetLineIndex]?.length ?? 0);
}

function isCollapsedSelection(
	selection: DocumentSelection | null,
	blockIndex: number,
) {
	return (
		selection?.anchor.blockIndex === blockIndex &&
		selection.focus.blockIndex === blockIndex &&
		selection.anchor.offset === selection.focus.offset
	);
}

function getPlainTextNavigationTarget(
	options: VerticalNavigationOptions,
): NavigationTarget | null {
	if (!isCollapsedSelection(options.selection, options.blockIndex)) {
		return null;
	}

	const currentBlock = options.document.blocks[options.blockIndex];
	if (!currentBlock) return null;

	const info = getLineInfo(
		currentBlock.content,
		options.selection?.focus.offset ?? 0,
	);
	const shouldMove =
		options.direction === "up" ? info.isFirstLine : info.isLastLine;
	if (!shouldMove) return null;

	const nextIndex =
		options.direction === "up"
			? options.blockIndex - 1
			: options.blockIndex + 1;
	const nextBlock = options.document.blocks[nextIndex];
	if (!nextBlock) return null;

	return {
		blockIndex: nextIndex,
		offset: getOffsetForColumn(
			nextBlock.content,
			options.direction,
			info.column,
		),
	};
}

function getSimpleBoundaryTarget(
	options: VerticalNavigationOptions,
): NavigationTarget | null {
	const nextIndex =
		options.direction === "up"
			? options.blockIndex - 1
			: options.blockIndex + 1;
	const nextBlock = options.document.blocks[nextIndex];
	if (!nextBlock) return null;

	return {
		blockIndex: nextIndex,
		offset: options.direction === "up" ? nextBlock.content.length : 0,
	};
}

export function getVerticalNavigationTarget(
	options: VerticalNavigationOptions,
): NavigationTarget | null {
	const block = options.document.blocks[options.blockIndex];
	if (!block) return null;

	switch (block.type) {
		case BlockType.paragraph:
		case BlockType.heading1:
		case BlockType.heading2:
		case BlockType.heading3:
		case BlockType.bulletList:
		case BlockType.numberedList:
		case BlockType.checkboxList:
		case BlockType.codeBlock:
			return getPlainTextNavigationTarget(options);
		case BlockType.mathBlock:
		case BlockType.image:
		case BlockType.video:
			return getSimpleBoundaryTarget(options);
		default:
			return null;
	}
}
