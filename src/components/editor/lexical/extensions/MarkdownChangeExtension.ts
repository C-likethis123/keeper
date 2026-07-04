import {
	registerPendingDispatchFlusher,
	unregisterPendingDispatchFlusher,
} from "@/components/editor/core/pendingDispatchRegistry";
import { namedSignals } from "@lexical/extension";
import { defineExtension, safeCast } from "lexical";
import { exportLexicalToMarkdown } from "../markdown";

const MARKDOWN_CHANGE_DEBOUNCE_MS = 300;

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
			let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
			const clearPendingTimeout = () => {
				if (pendingTimeout) {
					clearTimeout(pendingTimeout);
					pendingTimeout = null;
				}
			};
			const emitCurrentMarkdown = () => {
				clearPendingTimeout();
				editor.getEditorState().read(() => {
					const markdown = exportLexicalToMarkdown();
					if (markdown === lastMarkdown) return;
					lastMarkdown = markdown;
					getOnMarkdownChange.peek()()(markdown);
				});
			};
			const scheduleMarkdownEmit = () => {
				clearPendingTimeout();
				pendingTimeout = setTimeout(() => {
					pendingTimeout = null;
					emitCurrentMarkdown();
				}, MARKDOWN_CHANGE_DEBOUNCE_MS);
			};
			const key = `lexical-markdown-change-${editor.getKey()}`;
			registerPendingDispatchFlusher(key, emitCurrentMarkdown);

			const unregisterUpdateListener = editor.registerUpdateListener(
				() => scheduleMarkdownEmit(),
			);

			return () => {
				clearPendingTimeout();
				unregisterPendingDispatchFlusher(key, emitCurrentMarkdown);
				unregisterUpdateListener();
			};
		},
	});
}
