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
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { $createImageNode, ImageNode } from "./ImageNode";
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
	$getSelection,
	$insertNodes,
	$isRangeSelection,
	COMMAND_PRIORITY_EDITOR,
	type EditorState,
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
import { LexicalWikiLinkPlugin } from "./wikilinks/LexicalWikiLinkPlugin";

export interface LexicalEditorCommand {
	type: string;
	payload?: Record<string, unknown>;
	timestamp: number;
}

interface LexicalMarkdownEditorProps {
	command?: LexicalEditorCommand;
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

function insertBlockCommand(
	editor: LexicalEditor,
	payload?: Record<string, unknown>,
) {
	const block = payload?.block as EditorBlockPayload | undefined;
	if (!block) return;

	editor.update(() => {
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
	});
}

function insertMarkdownCommand(
	editor: LexicalEditor,
	payload?: Record<string, unknown>,
) {
	const markdown = payload?.markdown;
	if (typeof markdown !== "string" || markdown.length === 0) return;

	editor.update(() => {
		if (markdown.startsWith("> ")) {
			const quote = $createQuoteNode();
			quote.append($createTextNode(markdown.slice(2)));
			$insertNodes([quote]);
			return;
		}

		const paragraph = $createParagraphNode();
		paragraph.append($createTextNode(markdown));
		$insertNodes([paragraph]);
	});
}

function insertImageCommand(
	editor: LexicalEditor,
	payload?: Record<string, unknown>,
) {
	const src = payload?.src;
	if (typeof src !== "string" || src.length === 0) return;
	const altText = typeof payload?.altText === "string" ? payload.altText : "";

	editor.update(() => {
		$insertNodes([$createImageNode(src, altText)]);
	});
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

	editor.update(() => {
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
	});
}

function ChangePlugin({
	onMarkdownChange,
}: {
	onMarkdownChange: (markdown: string) => void;
}) {
	const lastMarkdownRef = useRef<string | null>(null);

	const handleChange = (editorState: EditorState) => {
		editorState.read(() => {
			const markdown = exportLexicalToMarkdown();
			if (markdown === lastMarkdownRef.current) return;
			lastMarkdownRef.current = markdown;
			onMarkdownChange(markdown);
		});
	};

	return <OnChangePlugin onChange={handleChange} />;
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
				},
				code: "keeper-code",
				quote: "keeper-quote",
				link: "keeper-link",
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
				minHeight: "100%",
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
					.keeper-placeholder {
						color: ${palette.text}80;
						pointer-events: none;
						position: absolute;
						top: 18px;
						left: 18px;
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
				.keeper-check-item { list-style: none; margin: 4px 0; }
				.keeper-check-item-checked { text-decoration: line-through; opacity: 0.7; }
				.keeper-code {
					background: ${palette.card};
					border: 1px solid ${palette.border};
					border-radius: 6px;
					font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
					font-size: 14px;
					padding: 12px;
					white-space: pre;
				}
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
					<RichTextPlugin
						contentEditable={<ContentEditable className="keeper-editor" />}
						placeholder={
							<div className="keeper-placeholder">Start writing</div>
						}
						ErrorBoundary={LexicalErrorBoundary}
					/>
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
					<TabIndentationPlugin />
					<ChangePlugin onMarkdownChange={onMarkdownChange} />
					<CommandPlugin command={command} />
				</div>
			</LexicalComposer>
		</div>
	);
}
