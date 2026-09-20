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
import { INSERT_UNORDERED_LIST_COMMAND, ListItemNode, ListNode } from "@lexical/list";
import { CodeNode } from "@lexical/code";
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { LinkNode } from "@lexical/link";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { INSERT_TABLE_COMMAND, TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { $setBlocksType } from "@lexical/selection";
import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, REDO_COMMAND, UNDO_COMMAND } from "lexical";
import type { EditorState } from "lexical";
import { type ReactNode, useEffect, useMemo, useRef } from "react";

type Props = { value: string; onChange: (value: string) => void };

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
		<div className="editor-toolbar__group" aria-label="Text style">
			<ToolbarButton label="Bold" onClick={() => format("bold")}><b>B</b></ToolbarButton>
			<ToolbarButton label="Italic" onClick={() => format("italic")}><i>I</i></ToolbarButton>
			<ToolbarButton label="Heading" onClick={heading}>H</ToolbarButton>
			<ToolbarButton label="Code block" onClick={code}>{"</>"}</ToolbarButton>
			<ToolbarButton label="Quote" onClick={quote}>❝</ToolbarButton>
		</div>
		<div className="editor-toolbar__group" aria-label="Insert">
			<ToolbarButton label="Bulleted list" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}>•≡</ToolbarButton>
			<ToolbarButton label="Insert table" onClick={() => editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: "3", includeHeaders: true, rows: "3" })}>▦</ToolbarButton>
		</div>
	</div>;
}

function Editor({ value, onChange }: Props) {
	const lastValue = useRef(value);
	useEffect(() => { lastValue.current = value; }, [value]);
	return (
		<LexicalComposer
			initialConfig={useMemo<InitialConfigType>(() => ({
				namespace: "keeper-vite",
				nodes: [HeadingNode, QuoteNode, CodeNode, ListNode, ListItemNode, LinkNode, TableNode, TableRowNode, TableCellNode],
				theme: {
					paragraph: "lexical-paragraph",
					text: { bold: "lexical-bold", italic: "lexical-italic" },
					heading: { h1: "lexical-heading lexical-heading--h1", h2: "lexical-heading lexical-heading--h2", h3: "lexical-heading lexical-heading--h3" },
					quote: "lexical-quote",
					code: "lexical-code",
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
	return <Editor key={props.value} {...props} />;
}
