export enum BlockType {
  heading1 = "heading1",
  heading2 = "heading2",
  heading3 = "heading3",
  bulletList = "bulletList",
  numberedList = "numberedList",
  checkboxList = "checkboxList",
  codeBlock = "codeBlock",
}
// image
// table
// wikilinks
// checklist to todo item
// inline markdown: inline code, italics, bold, strikethrough?

export interface EditorBlockPayload {
  type: BlockType;
  content: string;
  attributes?: Record<string, unknown>;
}

export function getBlockLanguage(
  block: EditorBlockPayload,
): string | undefined {
  const value = block.attributes?.language;
  return typeof value === "string" ? value : undefined;
}
