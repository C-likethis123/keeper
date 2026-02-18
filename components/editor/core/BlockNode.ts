/// Enum representing all possible block types in the editor
export enum BlockType {
	paragraph = "paragraph",
	heading1 = "heading1",
	heading2 = "heading2",
	heading3 = "heading3",
	bulletList = "bulletList",
	numberedList = "numberedList",
	checkboxList = "checkboxList",
	codeBlock = "codeBlock",
	mathBlock = "mathBlock",
	image = "image",
}

/// Immutable node representing a block of content in the document.
///
/// Each block has a unique ID, type, and content. Extensible metadata
/// (listLevel, language, checked, etc.) lives in attributes.
export interface BlockNode {
	readonly id: string;
	readonly type: BlockType;
	readonly content: string;
	readonly attributes: Record<string, unknown>;
}

export function getListLevel(block: BlockNode): number {
	const v = block.attributes?.listLevel;
	return typeof v === "number" ? v : 0;
}

export function getBlockLanguage(block: BlockNode): string | undefined {
	const v = block.attributes?.language;
	return typeof v === "string" ? v : undefined;
}

let idCounter = 0;

function generateId(): string {
	return `block_${++idCounter}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/// Creates a new paragraph block with generated ID
export function createParagraphBlock(content = ""): BlockNode {
	return {
		id: generateId(),
		type: BlockType.paragraph,
		content,
		attributes: {},
	};
}

/// Creates a new heading block
export function createHeadingBlock(
	level: BlockType.heading1 | BlockType.heading2 | BlockType.heading3,
	content = "",
): BlockNode {
	return {
		id: generateId(),
		type: level,
		content,
		attributes: {},
	};
}

/// Creates a new list block
export function createListBlock(
	numbered: boolean,
	content = "",
	listLevel = 0,
): BlockNode {
	return {
		id: generateId(),
		type: numbered ? BlockType.numberedList : BlockType.bulletList,
		content,
		attributes: { listLevel },
	};
}

/// Creates a new checkbox list block
export function createCheckboxBlock(
	content = "",
	listLevel = 0,
	checked = false,
): BlockNode {
	return {
		id: generateId(),
		type: BlockType.checkboxList,
		content,
		attributes: { listLevel, checked: !!checked },
	};
}

/// Creates a new code block
export function createCodeBlock(content = "", language?: string): BlockNode {
	return {
		id: generateId(),
		type: BlockType.codeBlock,
		content,
		attributes: language !== undefined && language !== "" ? { language } : {},
	};
}

/// Creates a new math block
export function createMathBlock(content = ""): BlockNode {
	return {
		id: generateId(),
		type: BlockType.mathBlock,
		content,
		attributes: {},
	};
}

/// Creates a new image block
export function createImageBlock(path: string): BlockNode {
	return {
		id: generateId(),
		type: BlockType.image,
		content: path,
		attributes: {},
	};
}

/// Creates a copy of this block with updated fields
export function copyBlock(
	block: BlockNode,
	updates: Partial<BlockNode>,
): BlockNode {
	return {
		id: updates.id ?? block.id,
		type: updates.type ?? block.type,
		content: updates.content ?? block.content,
		attributes: updates.attributes ?? block.attributes,
	};
}

/// Converts the block to its markdown representation
export function blockToMarkdown(block: BlockNode, listNumber?: number): string {
	const listIndentation = "  ".repeat(getListLevel(block));

	switch (block.type) {
		case BlockType.heading1:
			return `# ${block.content}`;
		case BlockType.heading2:
			return `## ${block.content}`;
		case BlockType.heading3:
			return `### ${block.content}`;
		case BlockType.bulletList:
			return `${listIndentation}- ${block.content}`;
		case BlockType.checkboxList: {
			const checked = !!block.attributes?.checked;
			return `${listIndentation}${checked ? "- [x] " : "- [ ] "}${block.content}`;
		}
		case BlockType.numberedList:
			return `${listIndentation}${listNumber ?? 1}. ${block.content}`;
		case BlockType.codeBlock:
			const lang = getBlockLanguage(block) ?? "";
			return `\`\`\`${lang}\n${block.content}\n\`\`\``;
		case BlockType.mathBlock:
			return `$$\n${block.content}\n$$`;
		case BlockType.image:
			return `![](${block.content})`;
		case BlockType.paragraph:
			return block.content;
	}
}

/// Whether this block is a code block
export function isCodeBlock(block: BlockNode): boolean {
	return block.type === BlockType.codeBlock;
}

/// Whether this block is a list item
export function isListItem(
	type: BlockType | null,
): type is BlockType.bulletList | BlockType.numberedList | BlockType.checkboxList {
	return (
		type === BlockType.bulletList ||
		type === BlockType.numberedList ||
		type === BlockType.checkboxList
	);
}

/// Whether this block is a heading
export function isHeading(block: BlockNode): boolean {
	return (
		block.type === BlockType.heading1 ||
		block.type === BlockType.heading2 ||
		block.type === BlockType.heading3
	);
}
