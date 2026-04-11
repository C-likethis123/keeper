import type { BlockNode, BlockType } from "@/components/editor/core/BlockNode";
import {
	BlockType as BT,
	getCollapsibleSummary,
} from "@/components/editor/core/BlockNode";

export interface BackspaceCommandContext {
	index: number;
	block: BlockNode;
	prevBlock: BlockNode | null;
	updateBlockType: (index: number, type: BlockType) => void;
	deleteBlock: (index: number) => void;
	mergeWithPrevious: (index: number) => void;
	focusBlock: (i: number) => void;
}

type BackspaceCommand = (ctx: BackspaceCommandContext) => boolean;

// 1. Convert non-paragraph blocks (except code/math/collapsible) to paragraph
const convertNonParagraphToDefault: BackspaceCommand = (ctx) => {
	const mergeableTypes = [
		BT.paragraph,
		BT.codeBlock,
		BT.mathBlock,
		BT.collapsibleBlock,
	];

	if (!mergeableTypes.includes(ctx.block.type)) {
		ctx.updateBlockType(ctx.index, BT.paragraph);
		ctx.focusBlock(ctx.index);
		return true;
	}
	return false;
};

// 2. Delete empty blocks
const deleteEmptyBlock: BackspaceCommand = (ctx) => {
	const isEmpty =
		ctx.block.type === BT.collapsibleBlock
			? ctx.block.content === "" && getCollapsibleSummary(ctx.block) === ""
			: ctx.block.content === "";

	if (!isEmpty) {
		return false;
	}

	ctx.deleteBlock(ctx.index);
	ctx.focusBlock(ctx.index > 0 ? ctx.index - 1 : 0);
	return true;
};

// 3. Skip collapsible blocks that have content (can't merge)
const skipCollapsibleWithContent: BackspaceCommand = (ctx) => {
	if (ctx.block.type === BT.collapsibleBlock) {
		return true;
	}
	return false;
};

// 4. Focus previous without merging if previous is non-mergeable
const focusPreviousNonMergeable: BackspaceCommand = (ctx) => {
	if (ctx.index <= 0) {
		return false;
	}

	const nonMergeableTypes = [BT.image, BT.video, BT.collapsibleBlock];
	if (ctx.prevBlock && nonMergeableTypes.includes(ctx.prevBlock.type)) {
		ctx.focusBlock(ctx.index - 1);
		return true;
	}
	return false;
};

// 5. Default: merge with previous block
const mergeWithPrevious: BackspaceCommand = (ctx) => {
	if (ctx.index <= 0) {
		return false;
	}

	ctx.mergeWithPrevious(ctx.index);
	ctx.focusBlock(ctx.index - 1);
	return true;
};

// Ordered command chain — first command to return true wins
const backspaceCommands: BackspaceCommand[] = [
	convertNonParagraphToDefault,
	deleteEmptyBlock,
	skipCollapsibleWithContent,
	focusPreviousNonMergeable,
	mergeWithPrevious,
];

export function runBackspaceChain(ctx: BackspaceCommandContext): void {
	for (const command of backspaceCommands) {
		if (command(ctx)) {
			break;
		}
	}
}
