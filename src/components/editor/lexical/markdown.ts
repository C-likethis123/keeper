import {
	$convertFromMarkdownString,
	$convertToMarkdownString,
	TRANSFORMERS,
} from "@lexical/markdown";

export const KEEPER_MARKDOWN_TRANSFORMERS = TRANSFORMERS;

export function importMarkdownToLexical(markdown: string) {
	$convertFromMarkdownString(markdown, KEEPER_MARKDOWN_TRANSFORMERS);
}

export function exportLexicalToMarkdown(): string {
	return $convertToMarkdownString(KEEPER_MARKDOWN_TRANSFORMERS);
}
