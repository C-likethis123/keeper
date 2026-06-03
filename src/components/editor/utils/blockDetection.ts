import { BlockType } from "./blockTypes";

interface BlockBuilder {
	type: BlockType;
	triggerPrefix?: RegExp;
}

const builders: BlockBuilder[] = [
	{
		type: BlockType.heading1,
		triggerPrefix: /^#\s+/,
	},
	{
		type: BlockType.heading2,
		triggerPrefix: /^##\s+/,
	},
	{
		type: BlockType.heading3,
		triggerPrefix: /^###\s+/,
	},
	{
		type: BlockType.checkboxList,
		triggerPrefix: /^-\s+\[[ xX]\]\s+/,
	},
	{
		type: BlockType.bulletList,
		triggerPrefix: /^-\s+/,
	},
	{
		type: BlockType.numberedList,
		triggerPrefix: /^(\d+)\.\s+/,
	},
	{
		type: BlockType.codeBlock,
		triggerPrefix: /^```([a-z]*)$/,
	},
];

export function detectBlockType(text: string): {
	type: BlockType;
	prefix: string;
	remainingContent: string;
	language?: string;
} | null {
	for (const builder of builders) {
		const prefix = builder.triggerPrefix;
		if (!prefix) {
			continue;
		}
		const match = text.match(prefix);
		if (match) {
			return {
				type: builder.type,
				prefix: match[0],
				remainingContent: text.substring(match[0].length),
				language:
					builder.type === BlockType.codeBlock
						? (match[1] ?? "plaintext")
						: undefined,
			};
		}
	}
	return null;
}
