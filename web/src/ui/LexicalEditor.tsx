import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { INSERT_CHECK_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, ListItemNode, ListNode } from "@lexical/list";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { registerCodeHighlighting } from "@lexical/code-prism";
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { LinkNode } from "@lexical/link";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { INSERT_TABLE_COMMAND, TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { $setBlocksType } from "@lexical/selection";
import { registerListKeyboardBehavior } from "@/ui/listKeyboard";
import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, INDENT_CONTENT_COMMAND, OUTDENT_CONTENT_COMMAND, REDO_COMMAND, UNDO_COMMAND } from "lexical";
import type { EditorState } from "lexical";
import { type ReactNode, useEffect, useMemo, useRef } from "react";

type Props = { value: string; onChange: (value: string) => void; editorKey?: string };

function ToolbarButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
	return <button className="editor-tool" type="button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function EditorToolbar() {
	const [editor] = useLexicalComposerContext();
	const format = (kind: "bold" | "italic") => editor.dispatchCommand(FORMAT_TEXT_COMMAND, kind);
	const heading = () => editor.update(() => {
		const selection = $getSelection();
		if ($isRangeSelection(selection)) $setBlocksType(selection, () => new HeadingNode("h2"));
	});
	const code = () => editor.update(() => {
		const selection = $getSelection();
		if ($isRangeSelection(selection)) $setBlocksType(selection, () => new CodeNode());
	});
	const quote = () => editor.update(() => {
		const selection = $getSelection();
		if ($isRangeSelection(selection)) $setBlocksType(selection, () => new QuoteNode());
	});

	return <div className="editor-toolbar" role="toolbar" aria-label="Formatting tools">
		<div className="editor-toolbar__group" aria-label="History">
			<ToolbarButton label="Undo" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>↶</ToolbarButton>
			<ToolbarButton label="Redo" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>↷</ToolbarButton>
		</div>
		<div className="editor-toolbar__group" aria-label="Indentation">
			<ToolbarButton label="Outdent" onClick={() => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)}>⇤</ToolbarButton>
			<ToolbarButton label="Indent" onClick={() => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)}>⇥</ToolbarButton>
		</div>
		<div className="editor-toolbar__group" aria-label="Text style">
			<ToolbarButton label="Bold" onClick={() => format("bold")}><b>B</b></ToolbarButton>
			<ToolbarButton label="Italic" onClick={() => format("italic")}><i>I</i></ToolbarButton>
			<ToolbarButton label="Heading" onClick={heading}>H</ToolbarButton>
			<ToolbarButton label="Code block" onClick={code}>{"</>"}</ToolbarButton>
			<ToolbarButton label="Quote" onClick={quote}>❝</ToolbarButton>
		</div>
		<div className="editor-toolbar__group" aria-label="Insert">
			<ToolbarButton label="Bulleted list" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}>•≡</ToolbarButton>
			<ToolbarButton label="Numbered list" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}>1≡</ToolbarButton>
			<ToolbarButton label="Checklist" onClick={() => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)}>☑</ToolbarButton>
			<ToolbarButton label="Insert table" onClick={() => editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: "3", includeHeaders: true, rows: "3" })}>▦</ToolbarButton>
		</div>
	</div>;
}

function ListKeyboardPlugin() {
	const [editor] = useLexicalComposerContext();
	useEffect(() => registerListKeyboardBehavior(editor), [editor]);
	return null;
}

/** Same Prism highlighter used by the React Native DOM editor. */
function CodeHighlightingPlugin() {
	const [editor] = useLexicalComposerContext();
	useEffect(() => registerCodeHighlighting(editor), [editor]);
	return null;
}

function Editor({ value, onChange }: Props) {
	const lastValue = useRef(value);
	useEffect(() => { lastValue.current = value; }, [value]);
	return (
		<LexicalComposer
			initialConfig={useMemo<InitialConfigType>(() => ({
				namespace: "keeper-vite",
				nodes: [HeadingNode, QuoteNode, CodeNode, CodeHighlightNode, ListNode, ListItemNode, LinkNode, TableNode, TableRowNode, TableCellNode],
				theme: {
					paragraph: "lexical-paragraph",
					text: { bold: "lexical-bold", italic: "lexical-italic" },
					heading: { h1: "lexical-heading lexical-heading--h1", h2: "lexical-heading lexical-heading--h2", h3: "lexical-heading lexical-heading--h3" },
					quote: "lexical-quote",
					code: "lexical-code",
					codeHighlight: {
						attr: "lexical-token-attr", boolean: "lexical-token-constant", builtin: "lexical-token-builtin", "class-name": "lexical-token-class", comment: "lexical-token-comment", constant: "lexical-token-constant", function: "lexical-token-function", keyword: "lexical-token-keyword", number: "lexical-token-number", operator: "lexical-token-operator", property: "lexical-token-property", punctuation: "lexical-token-punctuation", string: "lexical-token-string", variable: "lexical-token-variable",
					},
					table: "lexical-table",
					tableCell: "lexical-table-cell",
					tableCellHeader: "lexical-table-cell lexical-table-cell--header",
				},
				onError: (error) => console.error("Lexical error", error),
				editorState: () => { $convertFromMarkdownString(value, TRANSFORMERS); },
			}), [value])}
		>
			<div className="lexical-editor-shell">
				<EditorToolbar />
				<div className="lexical-editor-content">
					<RichTextPlugin
						contentEditable={<ContentEditable className="lexical-editor" aria-label="Note content" />}
						placeholder={<p className="editor-placeholder">Write a note…</p>}
						ErrorBoundary={({ children }) => <>{children}</>}
					/>
				</div>
			</div>
			<HistoryPlugin />
			<ListPlugin />
			<ListKeyboardPlugin />
			<CodeHighlightingPlugin />
			<TablePlugin />
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
	// A content value changes on every keystroke. Using it as a React key destroys
	// the Lexical tree and loses selection; only change the key for another note.
	return <Editor key={props.editorKey} {...props} />;
}
