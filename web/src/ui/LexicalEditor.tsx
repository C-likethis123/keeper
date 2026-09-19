import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { LinkNode } from "@lexical/link";
import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import type { EditorState } from "lexical";
import { useEffect, useMemo, useRef } from "react";

type Props = { value: string; onChange: (value: string) => void };

function Editor({ value, onChange }: Props) {
	const lastValue = useRef(value);
	useEffect(() => { lastValue.current = value; }, [value]);
	return (
		<LexicalComposer
			initialConfig={useMemo<InitialConfigType>(() => ({
				namespace: "keeper-vite",
				nodes: [ListNode, ListItemNode, LinkNode],
				theme: { paragraph: "lexical-paragraph", text: { bold: "lexical-bold", italic: "lexical-italic" } },
				onError: (error) => console.error("Lexical error", error),
				editorState: () => { $convertFromMarkdownString(value, TRANSFORMERS); },
			}), [value])}
		>
			<PlainTextPlugin
				contentEditable={<ContentEditable className="lexical-editor" aria-label="Note content" />}
				placeholder={<p className="editor-placeholder">Write a note…</p>}
				ErrorBoundary={({ children }) => <>{children}</>}
			/>
			<HistoryPlugin />
			<ListPlugin />
			<LinkPlugin />
			<MarkdownShortcutPlugin transformers={TRANSFORMERS} />
			<AutoFocusPlugin />
			<OnChangePlugin onChange={(state: EditorState) => {
				state.read(() => {
					const markdown = $convertToMarkdownString(TRANSFORMERS);
					if (markdown !== lastValue.current) {
						lastValue.current = markdown;
						onChange(markdown);
					}
				});
			}} />
		</LexicalComposer>
	);
}

/** DOM-first Lexical baseline: Markdown, lists, links, undo/redo. */
export function LexicalEditor(props: Props) {
	return <Editor key={props.value} {...props} />;
}
