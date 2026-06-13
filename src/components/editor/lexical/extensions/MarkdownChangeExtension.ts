import { effect, namedSignals } from "@lexical/extension";
import { defineExtension, safeCast } from "lexical";
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
		config: safeCast<MarkdownChangeExtensionOptions>({
			getOnMarkdownChange,
		}),
		build(_editor, config) {
			return namedSignals(config);
		},
		register(editor, _config, state) {
			const { getOnMarkdownChange } = state.getOutput();

			return effect(() =>
				editor.registerUpdateListener(({ editorState }) => {
					editorState.read(() => {
						const markdown = exportLexicalToMarkdown();
						if (markdown === lastMarkdown) return;
						lastMarkdown = markdown;
						getOnMarkdownChange.peek()(markdown);
					});
				})
			);
		},
	});
}
