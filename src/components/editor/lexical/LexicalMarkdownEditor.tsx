"use dom";

import {
	BlockType,
	type EditorBlockPayload,
	getBlockLanguage,
} from "@/components/editor/utils/blockTypes";
import { darkTheme } from "@/constants/themes/darkTheme";
import { lightTheme } from "@/constants/themes/lightTheme";
import {
	$createCodeNode,
	CodeHighlightNode,
	CodeNode,
} from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import {
	$createListItemNode,
	$createListNode,
	INSERT_CHECK_LIST_COMMAND,
	INSERT_ORDERED_LIST_COMMAND,
	INSERT_UNORDERED_LIST_COMMAND,
	ListItemNode,
	ListNode,
} from "@lexical/list";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalToolbarPlugin } from "./plugins/LexicalToolbarPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { $createImageNode, ImageNode } from "./ImageNode";
import {
	DetailsContentNode,
	DetailsNode,
	DetailsSummaryNode,
} from "./DetailsNode";
import { EquationNode } from "./equations/EquationNode";
import { EquationPlugin } from "./equations/EquationPlugin";
import { LexicalCodeBlockPlugin } from "./plugins/LexicalCodeBlockPlugin";
import { LexicalSlashCommandPlugin } from "./plugins/LexicalSlashCommandPlugin";

import {
	$createHeadingNode,
	$createQuoteNode,
	HeadingNode,
	QuoteNode,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
	INSERT_TABLE_COMMAND,
	TableCellNode,
	TableNode,
	TableRowNode,
} from "@lexical/table";
import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	$getSelection,
	$insertNodes,
	$isRangeSelection,
	COMMAND_PRIORITY_EDITOR,
	INDENT_CONTENT_COMMAND,
	KEY_TAB_COMMAND,
	type LexicalEditor,
	OUTDENT_CONTENT_COMMAND,
	REDO_COMMAND,
	UNDO_COMMAND,
} from "lexical";
import React, { useEffect, useMemo, useRef } from "react";
import {
	KEEPER_MARKDOWN_TRANSFORMERS,
	exportLexicalToMarkdown,
	importMarkdownToLexical,
} from "./markdown";
import { registerChecklistMarkdownPrefixTransform } from "./plugins/checklistMarkdownPrefix";
import { registerTodoTriggerTransform } from "./plugins/todoTriggerTransform";
import { LexicalWikiLinkPlugin } from "./wikilinks/LexicalWikiLinkPlugin";

interface LexicalEditorCommand {
	type: string;
	payload?: Record<string, unknown>;
	timestamp: number;
}

interface LexicalMarkdownEditorProps {
	command?: LexicalEditorCommand;
	dom?: import("expo/dom").DOMProps;
	hasAttachment?: boolean;
	keyboardHeight?: number;
	markdown: string;
	onMarkdownChange: (markdown: string) => void;
	onAttachDocument?: () => void;
	onInsertImage?: () => void;
	onInsertTemplateCommand?: () => void | Promise<void>;
	onOpenWikiLink?: (title: string) => void | Promise<void>;
	onRemoveAttachment?: () => void;
	onShowVideoModal?: () => void;
	onToggleActivePanel?: () => void;
	onToggleArticle?: () => void;
	onToggleRelatedNotes?: () => void;
	safeAreaInsets?: {
		top: number;
		right: number;
		bottom: number;
		left: number;
	};
	themeMode: "light" | "dark";
}

function CommandPlugin({ command }: { command?: LexicalEditorCommand }) {
	const [editor] = useLexicalComposerContext();
	const lastTimestampRef = useRef<number | null>(null);

	useEffect(() => {
		if (!command || command.timestamp === lastTimestampRef.current) {
			return;
		}
		lastTimestampRef.current = command.timestamp;

		switch (command.type) {
			case "undo":
				editor.dispatchCommand(UNDO_COMMAND, undefined);
				break;
			case "redo":
				editor.dispatchCommand(REDO_COMMAND, undefined);
				break;
			case "indent":
				editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
				break;
			case "outdent":
				editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
				break;
			case "focusEditor":
				editor.focus(undefined, { defaultSelection: "rootStart" });
				break;
			case "loadMarkdown":
				if (typeof command.payload?.markdown === "string") {
					editor.update(() =>
						importMarkdownToLexical(command.payload?.markdown as string),
					);
				}
				break;
			case "insertBlock":
				insertBlockCommand(editor, command.payload);
				break;
			case "insertMarkdown":
				insertMarkdownCommand(editor, command.payload);
				break;
			case "insertImage":
				insertImageCommand(editor, command.payload);
				break;
			case "updateType":
				applyTypeCommand(editor, command.payload);
				break;
		}
	}, [command, editor]);

	return null;
}

function TabIndentationPlugin() {
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		return editor.registerCommand(
			KEY_TAB_COMMAND,
			(event: KeyboardEvent) => {
				event.preventDefault();
				editor.dispatchCommand(
					event.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND,
					undefined,
				);
				return true;
			},
			COMMAND_PRIORITY_EDITOR,
		);
	}, [editor]);

	return null;
}

function ChecklistMarkdownPrefixPlugin() {
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		return registerChecklistMarkdownPrefixTransform(editor);
	}, [editor]);

	return null;
}

function TodoTriggerPlugin() {
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		return registerTodoTriggerTransform(editor);
	}, [editor]);

	return null;
}

function insertBlockCommand(
	editor: LexicalEditor,
	payload?: Record<string, unknown>,
) {
	const block = payload?.block as EditorBlockPayload | undefined;
	if (!block) return;

	editor.update(
		() => {
			if (block.type === BlockType.codeBlock) {
				const codeNode = $createCodeNode(getBlockLanguage(block));
				codeNode.append($createTextNode(block.content));
				$insertNodes([codeNode]);
				return;
			}

			if (block.type === BlockType.heading1) {
				const heading = $createHeadingNode("h1");
				heading.append($createTextNode(block.content));
				$insertNodes([heading]);
				return;
			}
			if (block.type === BlockType.heading2) {
				const heading = $createHeadingNode("h2");
				heading.append($createTextNode(block.content));
				$insertNodes([heading]);
				return;
			}
			if (block.type === BlockType.heading3) {
				const heading = $createHeadingNode("h3");
				heading.append($createTextNode(block.content));
				$insertNodes([heading]);
				return;
			}
			if (
				block.type === BlockType.bulletList ||
				block.type === BlockType.numberedList ||
				block.type === BlockType.checkboxList
			) {
				const listType =
					block.type === BlockType.numberedList
						? "number"
						: block.type === BlockType.checkboxList
							? "check"
							: "bullet";
				const list = $createListNode(listType);
				const item = $createListItemNode(
					block.type === BlockType.checkboxList
						? !!block.attributes?.checked
						: undefined,
				);
				item.append($createTextNode(block.content));
				list.append(item);
				$insertNodes([list]);
				return;
			}

			const paragraph = $createParagraphNode();
			paragraph.append($createTextNode(block.content));
			$insertNodes([paragraph]);
		},
		{ discrete: true },
	);
}

function insertMarkdownCommand(
	editor: LexicalEditor,
	payload?: Record<string, unknown>,
) {
	const markdown = payload?.markdown;
	if (typeof markdown !== "string" || markdown.length === 0) return;

	editor.update(
		() => {
			if (markdown.startsWith("> ")) {
				const quote = $createQuoteNode();
				quote.append($createTextNode(markdown.slice(2)));
				$insertNodes([quote]);
				return;
			}

			const paragraph = $createParagraphNode();
			paragraph.append($createTextNode(markdown));
			$insertNodes([paragraph]);
		},
		{ discrete: true },
	);
}

function insertImageCommand(
	editor: LexicalEditor,
	payload?: Record<string, unknown>,
) {
	const src = payload?.src;
	if (typeof src !== "string" || src.length === 0) return;
	const altText = typeof payload?.altText === "string" ? payload.altText : "";

	editor.update(
		() => {
			const imageNode = $createImageNode(src, altText);
			const selection = $getSelection();

			if ($isRangeSelection(selection)) {
				$insertNodes([imageNode]);
				return;
			}

			$getRoot().append(imageNode);
		},
		{ discrete: true },
	);
}

function applyTypeCommand(
	editor: LexicalEditor,
	payload?: Record<string, unknown>,
) {
	const type = payload?.type;
	if (typeof type !== "string") return;

	if (type === "bulletList") {
		editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
		return;
	}
	if (type === "numberedList") {
		editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
		return;
	}
	if (type === "checkboxList") {
		editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
		return;
	}
	if (type === "table") {
		editor.dispatchCommand(INSERT_TABLE_COMMAND, {
			columns: "3",
			rows: "3",
		});
		return;
	}

	editor.update(
		() => {
			const selection = $getSelection();
			if (!$isRangeSelection(selection)) return;

			if (type === "paragraph") {
				$setBlocksType(selection, () => $createParagraphNode());
			}
			if (type === "codeBlock") {
				const language =
					typeof payload?.language === "string" ? payload.language : undefined;
				$setBlocksType(selection, () => $createCodeNode(language));
			}
			if (type === "heading1" || type === "heading2" || type === "heading3") {
				const tag =
					type === "heading1" ? "h1" : type === "heading2" ? "h2" : "h3";
				$setBlocksType(selection, () => $createHeadingNode(tag));
			}
		},
		{ discrete: true },
	);
}

function ChangePlugin({
	onMarkdownChange,
}: {
	onMarkdownChange: (markdown: string) => void;
}) {
	const [editor] = useLexicalComposerContext();
	const lastMarkdownRef = useRef<string | null>(null);

	useEffect(() => {
		return editor.registerUpdateListener(({ editorState }) => {
			editorState.read(() => {
				const markdown = exportLexicalToMarkdown();
				if (markdown === lastMarkdownRef.current) return;
				lastMarkdownRef.current = markdown;
				onMarkdownChange(markdown);
			});
		});
	}, [editor, onMarkdownChange]);

	return null;
}

export default function LexicalMarkdownEditor({
	command,
	hasAttachment = false,
	keyboardHeight = 0,
	markdown,
	onAttachDocument,
	onInsertImage,
	onMarkdownChange,
	onInsertTemplateCommand,
	onOpenWikiLink,
	onRemoveAttachment,
	onShowVideoModal,
	onToggleActivePanel,
	onToggleArticle,
	onToggleRelatedNotes,
	safeAreaInsets,
	themeMode,
}: LexicalMarkdownEditorProps) {
	const palette = themeMode === "light" ? lightTheme.colors : darkTheme.colors;
	const initialConfig = useMemo(
		() => ({
			namespace: "KeeperLexicalEditor",
			nodes: [
				HeadingNode,
				QuoteNode,
				ListNode,
				ListItemNode,
				CodeNode,
				CodeHighlightNode,
				LinkNode,

				AutoLinkNode,
				TableNode,
				TableCellNode,
				TableRowNode,
				DetailsContentNode,
				DetailsNode,
				DetailsSummaryNode,
				EquationNode,
				ImageNode,
			],

			onError(error: Error) {
				throw error;
			},
			editorState: () => importMarkdownToLexical(markdown),
			theme: {
				heading: {
					h1: "keeper-heading keeper-heading-h1",
					h2: "keeper-heading keeper-heading-h2",
					h3: "keeper-heading keeper-heading-h3",
				},
				list: {
					ol: "keeper-list keeper-list-ol",
					ul: "keeper-list keeper-list-ul",
					listitem: "keeper-list-item",
					checklist: "keeper-list keeper-checklist",
					listitemChecked: "keeper-check-item keeper-check-item-checked",
					listitemUnchecked: "keeper-check-item keeper-check-item-unchecked",
					nested: {
						listitem: "keeper-nested-list-item",
					},
				},
				code: "keeper-code",
				codeHighlight: {
					attr: "keeper-token-attr",
					boolean: "keeper-token-constant",
					builtin: "keeper-token-builtin",
					"class-name": "keeper-token-class",
					comment: "keeper-token-comment",
					constant: "keeper-token-constant",
					deleted: "keeper-token-deleted",
					doctype: "keeper-token-comment",
					function: "keeper-token-function",
					inserted: "keeper-token-inserted",
					keyword: "keeper-token-keyword",
					namespace: "keeper-token-namespace",
					number: "keeper-token-number",
					operator: "keeper-token-operator",
					prolog: "keeper-token-comment",
					property: "keeper-token-property",
					punctuation: "keeper-token-punctuation",
					regex: "keeper-token-string",
					selector: "keeper-token-selector",
					string: "keeper-token-string",
					symbol: "keeper-token-symbol",
					tag: "keeper-token-tag",
					url: "keeper-token-string",
					variable: "keeper-token-variable",
				},
				quote: "keeper-quote",
				link: "keeper-link",
				table: "keeper-table",
				tableCell: "keeper-table-cell",
				tableCellHeader: "keeper-table-cell-header",
				tableRow: "keeper-table-row",
				tableScrollableWrapper: "keeper-table-scroll",
				tableSelection: "keeper-table-selection",
				text: {
					bold: "keeper-text-bold",
					italic: "keeper-text-italic",
					underline: "keeper-text-underline",
					code: "keeper-inline-code",
				},
			},
		}),
		[markdown],
	);

	return (
		<div
			style={{
				background: palette.background,
				color: palette.text,
				height: "100%",
				minHeight: "100%",
				overflowY: "auto",
				paddingTop: safeAreaInsets?.top ?? 0,
				paddingRight: safeAreaInsets?.right ?? 0,
				paddingBottom: Math.max(safeAreaInsets?.bottom ?? 0, keyboardHeight),
				paddingLeft: safeAreaInsets?.left ?? 0,
			}}
		>
			<style>{`
					.keeper-editor-shell {
						min-height: 100vh;
						padding: 18px 18px 40px;
						box-sizing: border-box;
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
						position: relative;
					}
					.keeper-editor {
						min-height: calc(100vh - 76px);
						outline: none;
						font-size: 17px;
					line-height: 1.55;
					white-space: pre-wrap;
				}
					.keeper-editor-content {
						position: relative;
					}
					.keeper-placeholder {
						color: ${palette.text}80;
						pointer-events: none;
						position: absolute;
						top: 0;
						left: 0;
						font-size: 17px;
						line-height: 1.55;
					}
				.keeper-heading {
					font-weight: 700;
					margin: 16px 0 8px;
				}
				.keeper-heading-h1 { font-size: 30px; }
				.keeper-heading-h2 { font-size: 24px; }
				.keeper-heading-h3 { font-size: 20px; }
				.keeper-list { margin: 8px 0; padding-left: 28px; }
				.keeper-list-item { margin: 4px 0; }
				.keeper-nested-list-item { list-style-type: none; }
				.keeper-checklist { list-style: none; padding-left: 0; }
				.keeper-check-item {
					cursor: pointer;
					list-style: none;
					margin: 4px 0;
					min-height: 24px;
					padding-left: 30px;
					position: relative;
				}
				.keeper-check-item::before {
					align-items: center;
					border: 1.5px solid ${palette.border};
					border-radius: 4px;
					box-sizing: border-box;
					content: "";
					display: flex;
					height: 18px;
					justify-content: center;
					left: 0;
					position: absolute;
					top: 4px;
					width: 18px;
				}
				.keeper-check-item-checked { text-decoration: line-through; opacity: 0.7; }
				.keeper-check-item-checked::before {
					background: ${palette.primary};
					border-color: ${palette.primary};
					color: ${palette.background};
					content: "\\2713";
					font-size: 13px;
					font-weight: 700;
					line-height: 1;
					text-decoration: none;
				}
				.keeper-table-scroll {
					margin: 12px 0;
					overflow-x: auto;
					width: 100%;
				}
				.keeper-table {
					border-collapse: collapse;
					border-spacing: 0;
					color: ${palette.text};
					table-layout: fixed;
					width: 100%;
				}
				.keeper-table-cell {
					border: 1px solid ${palette.border};
					min-width: 96px;
					padding: 8px 10px;
					position: relative;
					vertical-align: top;
				}
				.keeper-table-cell > * {
					margin: 0;
				}
				.keeper-table-cell-header {
					background: ${palette.card};
					font-weight: 700;
				}
				.keeper-table-selection .keeper-table-cell {
					border-color: ${palette.primary};
				}
				.keeper-table-cell:focus-within {
					box-shadow: inset 0 0 0 1px ${palette.primary};
					outline: none;
				}
				.image-node {
					margin: 12px 0;
					max-width: 100%;
				}
				.keeper-code {
					background: ${palette.card};
					border: 1px solid ${palette.border};
					border-radius: 6px;
					font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
					font-size: 14px;
					padding: 12px;
					white-space: pre;
				}
				.keeper-token-comment { color: ${themeMode === "light" ? "#6A737D" : "#8B949E"}; font-style: italic; }
				.keeper-token-keyword,
				.keeper-token-selector,
				.keeper-token-tag { color: ${themeMode === "light" ? "#D73A49" : "#FF7B72"}; }
				.keeper-token-string,
				.keeper-token-inserted { color: ${themeMode === "light" ? "#032F62" : "#A5D6FF"}; }
				.keeper-token-function,
				.keeper-token-builtin { color: ${themeMode === "light" ? "#6F42C1" : "#D2A8FF"}; }
				.keeper-token-class,
				.keeper-token-property,
				.keeper-token-namespace { color: ${themeMode === "light" ? "#E36209" : "#FFA657"}; }
				.keeper-token-number,
				.keeper-token-constant,
				.keeper-token-symbol,
				.keeper-token-variable { color: ${themeMode === "light" ? "#005CC5" : "#79C0FF"}; }
				.keeper-token-operator,
				.keeper-token-punctuation { color: ${themeMode === "light" ? "#24292E" : "#C9D1D9"}; }
				.keeper-token-deleted { color: ${themeMode === "light" ? "#B31D28" : "#FFA198"}; }
					.keeper-inline-code {
						background: ${palette.card};
						border-radius: 4px;
						font-size: 0.9em;
						font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
						line-height: 1.2;
						padding: 1px 4px 2px;
					}
				.keeper-quote {
					border-left: 3px solid ${palette.border};
					margin: 8px 0;
					padding-left: 12px;
					opacity: 0.85;
				}
				.keeper-link { color: ${palette.primary}; }
				.keeper-text-bold { font-weight: 700; }
				.keeper-text-italic { font-style: italic; }
				.keeper-text-underline { text-decoration: underline; }
			`}</style>
			<LexicalComposer initialConfig={initialConfig}>
				<div className="keeper-editor-shell">
					<LexicalToolbarPlugin
						hasAttachment={hasAttachment}
						onAttachDocument={onAttachDocument}
						onInsertImage={onInsertImage}
						onRemoveAttachment={onRemoveAttachment}
						onShowVideoModal={onShowVideoModal}
						onToggleActivePanel={onToggleActivePanel}
						onToggleArticle={onToggleArticle}
						onToggleRelatedNotes={onToggleRelatedNotes}
					/>
					<div className="keeper-editor-content">
						<RichTextPlugin
							contentEditable={<ContentEditable className="keeper-editor" />}
							placeholder={
								<div className="keeper-placeholder">Start writing</div>
							}
							ErrorBoundary={LexicalErrorBoundary}
						/>
					</div>
					<HistoryPlugin />
					<ListPlugin />
					<CheckListPlugin />
					<LexicalCodeBlockPlugin />
					<LexicalSlashCommandPlugin
						onInsertTemplateCommand={onInsertTemplateCommand}
					/>
					<LinkPlugin />
					<LexicalWikiLinkPlugin onOpenWikiLink={onOpenWikiLink} />
					<TablePlugin />
					<EquationPlugin />
					<MarkdownShortcutPlugin transformers={KEEPER_MARKDOWN_TRANSFORMERS} />
					<ChecklistMarkdownPrefixPlugin />
					<TodoTriggerPlugin />
					<TabIndentationPlugin />
					<ChangePlugin onMarkdownChange={onMarkdownChange} />
					<CommandPlugin command={command} />
				</div>
			</LexicalComposer>
		</div>
	);
}
