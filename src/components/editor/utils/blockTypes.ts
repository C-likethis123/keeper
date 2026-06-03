export enum BlockType {
	paragraph = "paragraph",
	heading1 = "heading1",
	heading2 = "heading2",
	heading3 = "heading3",
	bulletList = "bulletList",
	numberedList = "numberedList",
	checkboxList = "checkboxList",
	codeBlock = "codeBlock",
	video = "video",
}

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
