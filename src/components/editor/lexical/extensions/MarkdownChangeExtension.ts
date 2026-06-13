import { defineExtension } from "lexical";
import { exportLexicalToMarkdown } from "../markdown";

interface MarkdownChangeExtensionOptions {
	getOnMarkdownChange: () => (markdown: string) => void;
}

export function createMarkdownChangeExtension({
	getOnMarkdownChange,
}: MarkdownChangeExtensionOptions) {
	let lastMarkdown: string | null = null;

	return defineExtension({
		name: "keeper/MarkdownChange",
		register(editor) {
			return editor.registerUpdateListener(({ editorState }) => {
				editorState.read(() => {
					const markdown = exportLexicalToMarkdown();
					if (markdown === lastMarkdown) return;
					lastMarkdown = markdown;
					getOnMarkdownChange()(markdown);
				});
			});
		},
	});
}
