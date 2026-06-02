"use dom";

import { darkTheme } from "@/constants/themes/darkTheme";
import { lightTheme } from "@/constants/themes/lightTheme";
import {
	type BlockNode,
	blockToMarkdown,
} from "@/components/editor/core/BlockNode";
import { CodeHighlightNode, CodeNode, registerCodeHighlighting } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import {
	ListItemNode,
	ListNode,
	INSERT_CHECK_LIST_COMMAND,
	INSERT_ORDERED_LIST_COMMAND,
	INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HeadingNode, QuoteNode, $createHeadingNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
	$getSelection,
	$createParagraphNode,
	$createTextNode,
	$insertNodes,
	$isRangeSelection,
	COMMAND_PRIORITY_EDITOR,
	INDENT_CONTENT_COMMAND,
	KEY_TAB_COMMAND,
	OUTDENT_CONTENT_COMMAND,
	REDO_COMMAND,
	UNDO_COMMAND,
	type EditorState,
	type LexicalEditor,
} from "lexical";
import React, { useEffect, useMemo, useRef } from "react";
import {
	exportLexicalToMarkdown,
	importMarkdownToLexical,
	KEEPER_MARKDOWN_TRANSFORMERS,
} from "./markdown";

export interface LexicalEditorCommand {
	type: string;
	payload?: Record<string, unknown>;
	timestamp: number;
}

interface LexicalMarkdownEditorProps {
	command?: LexicalEditorCommand;
	keyboardHeight?: number;
	markdown: string;
	onMarkdownChange: (markdown: string) => void;
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

function CodeHighlightingPlugin() {
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		return registerCodeHighlighting(editor);
	}, [editor]);

	return null;
}

function insertBlockCommand(
	editor: LexicalEditor,
	payload?: Record<string, unknown>,
) {
	const block = payload?.block as BlockNode | undefined;
	if (!block) return;

	editor.update(() => {
		const paragraph = $createParagraphNode();
		paragraph.append($createTextNode(blockToMarkdown(block)));
		$insertNodes([paragraph]);
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
	if (type === "collapsibleBlock") {
		editor.update(() => {
			const paragraph = $createParagraphNode();
			paragraph.append(
				$createTextNode("<details open>\n<summary></summary>\n\n\n\n</details>"),
			);
			$insertNodes([paragraph]);
		});
		return;
	}

	editor.update(() => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) return;

		if (type === "paragraph") {
			$setBlocksType(selection, () => $createParagraphNode());
		}
		if (type === "heading1" || type === "heading2" || type === "heading3") {
			const tag = type === "heading1" ? "h1" : type === "heading2" ? "h2" : "h3";
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
	keyboardHeight = 0,
	markdown,
	onMarkdownChange,
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
					<RichTextPlugin
						contentEditable={<ContentEditable className="keeper-editor" />}
						placeholder={<div className="keeper-placeholder">Start writing</div>}
						ErrorBoundary={LexicalErrorBoundary}
					/>
						<HistoryPlugin />
						<ListPlugin />
						<CheckListPlugin />
						<CodeHighlightingPlugin />
						<LinkPlugin />
						<MarkdownShortcutPlugin transformers={KEEPER_MARKDOWN_TRANSFORMERS} />
						<TabIndentationPlugin />
						<ChangePlugin onMarkdownChange={onMarkdownChange} />
					<CommandPlugin command={command} />
				</div>
			</LexicalComposer>
		</div>
	);
}
