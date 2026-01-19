/// Enum representing all possible block types in the editor
export enum BlockType {
  paragraph = 'paragraph',
  heading1 = 'heading1',
  heading2 = 'heading2',
  heading3 = 'heading3',
  bulletList = 'bulletList',
  numberedList = 'numberedList',
  codeBlock = 'codeBlock',
  mathBlock = 'mathBlock',
  image = 'image',
}

/// Immutable node representing a block of content in the document.
///
/// Each block has a unique ID, type, and content. Code blocks also
/// store the programming language for syntax highlighting.
export interface BlockNode {
  readonly id: string;
  readonly type: BlockType;
  readonly content: string;
  readonly language?: string; // For code blocks
  readonly listLevel: number; // For list blocks
  readonly attributes: Record<string, unknown>;
}

let idCounter = 0;

function generateId(): string {
  return `block_${++idCounter}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/// Creates a new paragraph block with generated ID
export function createParagraphBlock(content = ''): BlockNode {
  return {
    id: generateId(),
    type: BlockType.paragraph,
    content,
    listLevel: 0,
    attributes: {},
  };
}

/// Creates a new heading block
export function createHeadingBlock(level: BlockType.heading1 | BlockType.heading2 | BlockType.heading3, content = ''): BlockNode {
  return {
    id: generateId(),
    type: level,
    content,
    listLevel: 0,
    attributes: {},
  };
}

/// Creates a new list block
export function createListBlock(
  numbered: boolean,
  content = '',
  listLevel = 0,
): BlockNode {
  return {
    id: generateId(),
    type: numbered ? BlockType.numberedList : BlockType.bulletList,
    content,
    listLevel,
    attributes: {},
  };
}

/// Creates a new code block
export function createCodeBlock(content = '', language?: string): BlockNode {
  return {
    id: generateId(),
    type: BlockType.codeBlock,
    content,
    language,
    listLevel: 0,
    attributes: {},
  };
}

/// Creates a new math block
export function createMathBlock(content = ''): BlockNode {
  return {
    id: generateId(),
    type: BlockType.mathBlock,
    content,
    listLevel: 0,
    attributes: {},
  };
}

/// Creates a new image block
export function createImageBlock(path: string): BlockNode {
  return {
    id: generateId(),
    type: BlockType.image,
    content: path,
    listLevel: 0,
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
    language: updates.language ?? block.language,
    listLevel: updates.listLevel ?? block.listLevel,
    attributes: updates.attributes ?? block.attributes,
  };
}

/// Converts the block to its markdown representation
export function blockToMarkdown(block: BlockNode, listNumber?: number): string {
  const listIndentation = '  '.repeat(block.listLevel);

  switch (block.type) {
    case BlockType.heading1:
      return `# ${block.content}`;
    case BlockType.heading2:
      return `## ${block.content}`;
    case BlockType.heading3:
      return `### ${block.content}`;
    case BlockType.bulletList:
      return `${listIndentation}- ${block.content}`;
    case BlockType.numberedList:
      return `${listIndentation}${listNumber ?? 1}. ${block.content}`;
    case BlockType.codeBlock:
      const lang = block.language ?? '';
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
export function isListItem(block: BlockNode): boolean {
  return block.type === BlockType.bulletList || block.type === BlockType.numberedList;
}

/// Whether this block is a heading
export function isHeading(block: BlockNode): boolean {
  return (
    block.type === BlockType.heading1 ||
    block.type === BlockType.heading2 ||
    block.type === BlockType.heading3
  );
}

