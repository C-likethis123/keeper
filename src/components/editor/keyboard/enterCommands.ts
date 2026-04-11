import type { BlockNode, BlockType } from "@/components/editor/core/BlockNode";
import {
	BlockType as BT,
	createParagraphBlock,
} from "@/components/editor/core/BlockNode";

export interface EnterCommandContext {
	index: number;
	cursorOffset: number;
	zone?: "summary" | "body";
	block: BlockNode;
	getBlockAtIndex: (i: number) => BlockNode | null;
	detectBlockType: (
		index: number,
		content: string,
		opts?: {
			ignoreContentChange?: boolean;
			preserveFocus?: boolean;
			onlyIfTypeChanges?: boolean;
		},
	) => boolean;
	convertTrackedTodo: (
		index: number,
		opts?: { insertNextBlock?: boolean },
	) => boolean;
	updateBlockType: (index: number, type: BlockType) => void;
	focusBlock: (i: number) => void;
	splitBlock: (index: number, offset: number) => void;
	insertBlockAfter: (index: number, block: BlockNode) => void;
	setBlockContent: (index: number, content: string) => void;
}

type EnterCommand = (ctx: EnterCommandContext) => boolean;

// 1. Code and math blocks handle their own newlines — skip Enter processing
const skipCodeAndMathBlocks: EnterCommand = (ctx) => {
	if (
		ctx.block.type === BT.codeBlock ||
		ctx.block.type === BT.mathBlock
	) {
		return true;
	}
	return false;
};

// 2. Collapsible block Enter handling
const handleCollapsibleEnter: EnterCommand = (ctx) => {
	if (ctx.block.type !== BT.collapsibleBlock) {
		return false;
	}

	if (ctx.zone === "summary") {
		// Handled locally in CollapsibleBlock
		return true;
	}

	// Body zone: split content at cursor, insert paragraph after, focus next
	const content = ctx.block.content;
	const before = content.substring(0, ctx.cursorOffset).replace(/\n$/, "");
	const after = content.substring(ctx.cursorOffset).replace(/^\n/, "");

	ctx.setBlockContent(ctx.index, before);
	ctx.insertBlockAfter(ctx.index, createParagraphBlock(after));
	ctx.focusBlock(ctx.index + 1);
	return true;
};

// 3. Run block type detection (markdown prefix matching)
const runBlockTypeDetection: EnterCommand = (ctx) => {
	return ctx.detectBlockType(ctx.index, ctx.block.content, {
		onlyIfTypeChanges: true,
	});
};

// 4. Convert tracked todo on Enter
const convertTrackedTodo: EnterCommand = (ctx) => {
	return ctx.convertTrackedTodo(ctx.index, { insertNextBlock: true });
};

// 5. Exit empty list blocks (convert to paragraph)
const exitEmptyList: EnterCommand = (ctx) => {
	const isEmptyList =
		ctx.block.content.trim() === "" &&
		[BT.numberedList, BT.bulletList, BT.checkboxList].includes(ctx.block.type);

	if (!isEmptyList) {
		return false;
	}

	ctx.updateBlockType(ctx.index, BT.paragraph);
	ctx.focusBlock(ctx.index);
	return true;
};

// 6. Default: split block at cursor
const splitBlock: EnterCommand = (ctx) => {
	ctx.splitBlock(ctx.index, ctx.cursorOffset);
	ctx.focusBlock(ctx.index + 1);
	return true;
};

// Ordered command chain — first command to return true wins
const enterCommands: EnterCommand[] = [
	skipCodeAndMathBlocks,
	handleCollapsibleEnter,
	runBlockTypeDetection,
	convertTrackedTodo,
	exitEmptyList,
	splitBlock,
];

export function runEnterChain(ctx: EnterCommandContext): void {
	for (const command of enterCommands) {
		if (command(ctx)) {
			break;
		}
	}
}
