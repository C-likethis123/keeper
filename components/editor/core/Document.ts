import {
	type BlockNode,
	BlockType,
	blockToMarkdown,
	createCheckboxBlock,
	createCodeBlock,
	createHeadingBlock,
	createImageBlock,
	createListBlock,
	createMathBlock,
	createParagraphBlock,
	getListLevel,
	isCodeBlock,
} from "./BlockNode";

/// Immutable document representing the entire editor content.
///
/// The document is a flat list of blocks. All modifications return
/// a new Document instance, following the immutable pattern.
export interface Document {
	readonly blocks: readonly BlockNode[];
	readonly version: number;
}

/// Creates an empty document with a single paragraph
export function createEmptyDocument(): Document {
	return {
		blocks: [createParagraphBlock()],
		version: 0,
	};
}

/// Creates a document from a list of blocks
export function createDocumentFromBlocks(blocks: BlockNode[]): Document {
	if (blocks.length === 0) {
		return createEmptyDocument();
	}
	return {
		blocks: Object.freeze([...blocks]),
		version: 0,
	};
}

/// Creates a document from markdown text
export function createDocumentFromMarkdown(markdown: string): Document {
	if (markdown.trim().length === 0) {
		return createEmptyDocument();
	}

	const blocks: BlockNode[] = [];
	const lines = markdown.split("\n");

	let i = 0;
	while (i < lines.length) {
		const line = lines[i];

		// Check for code blocks
		if (line.startsWith("```")) {
			const language = line.substring(3).trim();
			const codeLines: string[] = [];
			i++;

			while (i < lines.length && !lines[i].startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}

			blocks.push(
				createCodeBlock(
					codeLines.join("\n"),
					language.length === 0 ? undefined : language,
				),
			);
			i++; // Skip closing ```
			continue;
		}

		// Check for math blocks
		if (line.startsWith("$$")) {
			const mathLines: string[] = [];
			i++;

			while (i < lines.length && !lines[i].startsWith("$$")) {
				mathLines.push(lines[i]);
				i++;
			}

			blocks.push(createMathBlock(mathLines.join("\n")));
			i++; // Skip closing $$
			continue;
		}

		// Check for image
		if (line.startsWith("![](")) {
			const imagePath = line.substring(4, line.length - 1);
			blocks.push(createImageBlock(imagePath));
			i++;
			continue;
		}

		// Check for headings
		if (line.startsWith("### ")) {
			blocks.push(createHeadingBlock(BlockType.heading3, line.substring(4)));
		} else if (line.startsWith("## ")) {
			blocks.push(createHeadingBlock(BlockType.heading2, line.substring(3)));
		} else if (line.startsWith("# ")) {
			blocks.push(createHeadingBlock(BlockType.heading1, line.substring(2)));
		} else if (/^(\s*)- \[([ xX])\]\s+(.*)$/.test(line)) {
			const checkboxMatch = line.match(/^(\s*)- \[([ xX])\]\s+(.*)$/);
			if (checkboxMatch) {
				const leadingSpaces = checkboxMatch[1].length;
				const listLevel = Math.floor(leadingSpaces / 2);
				const checked = checkboxMatch[2].toLowerCase() === "x";
				const content = checkboxMatch[3];
				blocks.push(createCheckboxBlock(content, listLevel, checked));
			}
		} else if (/^(\s*)([-*]|\d+\.)\s+(.*)$/.test(line)) {
			const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
			if (listMatch) {
				const leadingSpaces = listMatch[1].length;
				const marker = listMatch[2];
				const content = listMatch[3];

				// 2 spaces per indent level
				const listLevel = Math.floor(leadingSpaces / 2);

				const isNumbered = marker.endsWith(".");

				blocks.push(createListBlock(isNumbered, content, listLevel));
			}
		} else if (line.length === 0) {
			// Skip consecutive empty lines, but keep one as paragraph separator
			if (blocks.length > 0 && blocks[blocks.length - 1].content.length > 0) {
				blocks.push(createParagraphBlock(""));
			}
		} else {
			// Regular paragraph
			blocks.push(createParagraphBlock(line));
		}

		i++;
	}

	if (blocks.length === 0) {
		return createEmptyDocument();
	}

	return {
		blocks: Object.freeze(blocks),
		version: 0,
	};
}

/// Number of blocks in the document
export function getDocumentLength(document: Document): number {
	return document.blocks.length;
}

/// Whether the document is empty (only has one empty paragraph)
export function isDocumentEmpty(document: Document): boolean {
	return (
		document.blocks.length === 1 &&
		document.blocks[0].type === BlockType.paragraph &&
		document.blocks[0].content.length === 0
	);
}

/// Gets a block by index
export function getBlock(document: Document, index: number): BlockNode {
	return document.blocks[index];
}

/// Creates a new document with the block at index replaced
export function updateBlock(
	document: Document,
	index: number,
	newBlock: BlockNode,
): Document {
	if (index < 0 || index >= document.blocks.length) {
		throw new Error("Block index out of range");
	}

	const newBlocks = [...document.blocks];
	newBlocks[index] = newBlock;

	return {
		blocks: Object.freeze(newBlocks),
		version: document.version + 1,
	};
}

/// Creates a new document with a block inserted at index
export function insertBlock(
	document: Document,
	index: number,
	block: BlockNode,
): Document {
	if (index < 0 || index > document.blocks.length) {
		throw new Error("Insert index out of range");
	}

	const newBlocks = [...document.blocks];
	newBlocks.splice(index, 0, block);

	return {
		blocks: Object.freeze(newBlocks),
		version: document.version + 1,
	};
}

/// Creates a new document with the block at index removed
export function removeBlock(document: Document, index: number): Document {
	if (index < 0 || index >= document.blocks.length) {
		throw new Error("Block index out of range");
	}

	if (document.blocks.length === 1) {
		// Don't remove the last block, just clear it
		return updateBlock(document, 0, createParagraphBlock());
	}

	const newBlocks = [...document.blocks];
	newBlocks.splice(index, 1);

	return {
		blocks: Object.freeze(newBlocks),
		version: document.version + 1,
	};
}

/// Creates a new document with blocks replaced in a range
export function replaceBlocks(
	document: Document,
	start: number,
	end: number,
	newBlocks: BlockNode[],
): Document {
	if (start < 0 || start > document.blocks.length) {
		throw new Error("Start index out of range");
	}
	if (end < start || end > document.blocks.length) {
		throw new Error("End index out of range");
	}

	const result = [
		...document.blocks.slice(0, start),
		...newBlocks,
		...document.blocks.slice(end),
	];

	if (result.length === 0) {
		return createEmptyDocument();
	}

	return {
		blocks: Object.freeze(result),
		version: document.version + 1,
	};
}

function calculateListItemNumber(
	document: Document,
	index: number,
): number | undefined {
	const block = document.blocks[index];
	if (block.type !== BlockType.numberedList) {
		return undefined;
	}

	const listLevel = getListLevel(block);
	let number = 1;
	for (let i = index - 1; i >= 0; i--) {
		const prevBlock = document.blocks[i];
		if (
			prevBlock.type !== BlockType.numberedList ||
			getListLevel(prevBlock) < listLevel
		) {
			break;
		}
		if (
			prevBlock.type === BlockType.numberedList &&
			getListLevel(prevBlock) === listLevel
		) {
			number++;
		}
	}
	return number;
}

/// Converts the document to markdown
export function documentToMarkdown(document: Document): string {
	const buffer: string[] = [];
	for (let i = 0; i < document.blocks.length; i++) {
		buffer.push(
			blockToMarkdown(document.blocks[i], calculateListItemNumber(document, i)),
		);
		if (i < document.blocks.length - 1) {
			buffer.push("\n");
			// Add extra newline after code blocks
			const block = document.blocks[i];
			if (isCodeBlock(block) || block.type === BlockType.mathBlock) {
				buffer.push("\n");
			}
		}
	}
	return buffer.join("");
}

/// Gets the total character count of the document
export function getCharacterCount(document: Document): number {
	return document.blocks.reduce((sum, block) => sum + block.content.length, 0);
}

/// Gets the word count of the document
export function getWordCount(document: Document): number {
	return document.blocks.reduce((sum, block) => {
		if (block.content.trim().length === 0) {
			return sum;
		}
		return sum + block.content.trim().split(/\s+/).length;
	}, 0);
}
