"use dom";

import { flushAllPendingEditorDispatches } from "@/components/editor/core/pendingDispatchRegistry";
import { darkTheme } from "@/constants/themes/darkTheme";
import { lightTheme } from "@/constants/themes/lightTheme";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { ImageNode } from "./image/ImageNode";
import {
  DetailsContentNode,
  DetailsNode,
  DetailsSummaryNode,
} from "./DetailsNode";
import { EquationNode } from "./equations/EquationNode";

import { $getRoot } from "lexical";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KEEPER_MARKDOWN_TRANSFORMERS,
  importMarkdownToLexical,
} from "./markdown";
import type { LexicalEditorCommand } from "./extensions/CommandExtension";
import { createKeeperEditorExtension } from "./extensions/KeeperEditorExtension";

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

function EmptyPlaceholder() {
  const [editor] = useLexicalComposerContext();
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    editor.getEditorState().read(() => {
      setIsEmpty($getRoot().isEmpty());
    });

    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        setIsEmpty($getRoot().isEmpty());
      });
    });
  }, [editor]);

  if (!isEmpty) {
    return null;
  }

  return <div className="keeper-placeholder">Start writing</div>;
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
  const editorContentElementRef = useRef<HTMLDivElement | null>(null);
  const initialMarkdownRef = useRef(markdown);
  const commandRef = useRef<LexicalEditorCommand | undefined>(command);
  const onMarkdownChangeRef = useRef(onMarkdownChange);
  const onInsertTemplateCommandRef = useRef(onInsertTemplateCommand);
  const onOpenWikiLinkRef = useRef(onOpenWikiLink);
  const hasAttachmentRef = useRef(hasAttachment ?? false);
  const onAttachDocumentRef = useRef(onAttachDocument);
  const onInsertImageRef = useRef(onInsertImage);
  const onRemoveAttachmentRef = useRef(onRemoveAttachment);
  const onShowVideoModalRef = useRef(onShowVideoModal);
  const onToggleActivePanelRef = useRef(onToggleActivePanel);
  const onToggleArticleRef = useRef(onToggleArticle);
  const onToggleRelatedNotesRef = useRef(onToggleRelatedNotes);
  const setEditorContentElement = useCallback(
    (element: HTMLDivElement | null) => {
      editorContentElementRef.current = element;
    },
    [],
  );

  useEffect(() => {
    commandRef.current = command;
    flushAllPendingEditorDispatches();
  }, [command]);

  useEffect(() => {
    onMarkdownChangeRef.current = onMarkdownChange;
  }, [onMarkdownChange]);

  useEffect(() => {
    onInsertTemplateCommandRef.current = onInsertTemplateCommand;
  }, [onInsertTemplateCommand]);

  useEffect(() => {
    onOpenWikiLinkRef.current = onOpenWikiLink;
  }, [onOpenWikiLink]);

  useEffect(() => {
    hasAttachmentRef.current = hasAttachment ?? false;
    onAttachDocumentRef.current = onAttachDocument;
    onInsertImageRef.current = onInsertImage;
    onRemoveAttachmentRef.current = onRemoveAttachment;
    onShowVideoModalRef.current = onShowVideoModal;
    onToggleActivePanelRef.current = onToggleActivePanel;
    onToggleArticleRef.current = onToggleArticle;
    onToggleRelatedNotesRef.current = onToggleRelatedNotes;
  }, [
    hasAttachment,
    onAttachDocument,
    onInsertImage,
    onRemoveAttachment,
    onShowVideoModal,
    onToggleActivePanel,
    onToggleArticle,
    onToggleRelatedNotes,
  ]);

  const editorExtension = useMemo(
    () =>
      createKeeperEditorExtension({
        getCommand: () => commandRef.current,
        getDraggableBlockAnchorElem: () => editorContentElementRef.current,
        getOnInsertTemplateCommand: () => onInsertTemplateCommandRef.current,
        getOnMarkdownChange: () => onMarkdownChangeRef.current,
        getOnOpenWikiLink: () => onOpenWikiLinkRef.current,
        getHasAttachment: () => hasAttachmentRef.current,
        getOnAttachDocument: () => onAttachDocumentRef.current,
        getOnInsertImage: () => onInsertImageRef.current,
        getOnRemoveAttachment: () => onRemoveAttachmentRef.current,
        getOnShowVideoModal: () => onShowVideoModalRef.current,
        getOnToggleActivePanel: () => onToggleActivePanelRef.current,
        getOnToggleArticle: () => onToggleArticleRef.current,
        getOnToggleRelatedNotes: () => onToggleRelatedNotesRef.current,
        nodes: [
          CodeNode,
          CodeHighlightNode,
          AutoLinkNode,
          DetailsContentNode,
          DetailsNode,
          DetailsSummaryNode,
          EquationNode,
          ImageNode,
        ],
        editorState: () => importMarkdownToLexical(initialMarkdownRef.current),
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
    [],
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
					.keeper-toolbar-sticky {
						position: sticky;
						top: 0;
						z-index: 10;
						background: ${palette.background};
					}
					.keeper-editor {
						box-sizing: border-box;
						min-height: calc(100vh - 76px);
						outline: none;
						padding-left: 28px;
						font-size: 17px;
					line-height: 1.55;
					white-space: pre-wrap;
				}
					.keeper-editor-content {
						position: relative;
					}
					.keeper-draggable-block-anchor {
						inset: 0;
						pointer-events: none;
						position: absolute;
						z-index: 5;
					}
					.keeper-draggable-block-anchor > div {
						pointer-events: auto;
					}
					.keeper-editor-content > div[draggable="true"] {
						height: 24px;
						left: 0;
						overflow: visible;
						position: absolute;
						top: 0;
						width: 24px;
						z-index: 7;
					}
					.keeper-draggable-block-handle {
						align-items: center;
						background: transparent;
						border: 0;
						border-radius: 6px;
						color: ${palette.text}8A;
						cursor: grab;
						display: flex;
						font-size: 18px;
						height: 24px;
						justify-content: center;
						left: 0;
						line-height: 1;
						opacity: 1;
						padding: 0;
						pointer-events: auto;
						position: absolute;
						top: 0;
						touch-action: none;
						transition: opacity 120ms ease, background-color 120ms ease;
						user-select: none;
						will-change: transform, opacity;
						width: 24px;
					}
					.keeper-draggable-block-handle:active,
					.keeper-draggable-block-handle-active {
						cursor: grabbing;
					}
					.keeper-draggable-block-handle:hover,
					.keeper-draggable-block-handle:focus-visible {
						background: ${palette.card};
						opacity: 1;
					}
					.keeper-editor-content:hover .keeper-draggable-block-handle {
						opacity: 1;
					}
					.keeper-draggable-block-dragging {
						opacity: 0.45;
					}
					.keeper-draggable-block-handle span,
					.keeper-draggable-block-handle span::before,
					.keeper-draggable-block-handle span::after {
						background: currentColor;
						border-radius: 999px;
						box-shadow: 6px 0 0 currentColor;
						content: "";
						display: block;
						height: 3px;
						width: 3px;
					}
					.keeper-draggable-block-handle span::before {
						transform: translateY(-6px);
					}
					.keeper-draggable-block-handle span::after {
						transform: translateY(3px);
					}
					.keeper-draggable-block-target-line {
						background: ${palette.primary};
						border-radius: 999px;
						height: 4px;
						left: 0;
						opacity: 0;
						pointer-events: none;
						position: absolute;
						top: 0;
						z-index: 6;
					}
					.keeper-placeholder {
						color: ${palette.text}80;
						pointer-events: none;
						position: absolute;
						top: 0;
						left: 28px;
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
					.keeper-table-control {
						align-items: center;
						display: flex;
						gap: 4px;
						position: absolute;
						transform: translate(-50%, -50%);
						z-index: 6;
					}
					.keeper-table-control-button {
						align-items: center;
						background: ${palette.primary};
						border: 0;
						border-radius: 999px;
						box-shadow: 0 8px 18px ${palette.shadow}33;
						color: #fff;
						cursor: pointer;
						display: flex;
						font-size: 16px;
						font-weight: 500;
						height: 24px;
						justify-content: center;
						line-height: 1;
						padding: 0 0 2px;
						width: 24px;
					}
					.keeper-table-control-delete {
						background: ${palette.textSecondary};
					}
					.keeper-table-control-button:hover,
					.keeper-table-control-button:focus-visible {
						filter: brightness(1.08);
						outline: 2px solid ${palette.primary}66;
						outline-offset: 2px;
					}
					.image-node {
						margin: 12px 0;
						max-width: 100%;
					}
				.keeper-code {
					background: ${palette.card};
					border: 1px solid ${palette.border};
					border-radius: 6px;
					box-sizing: border-box;
					display: block;
					font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
					font-size: 14px;
					line-height: 1.45;
					margin: 12px 0;
					max-width: 100%;
					overflow-x: auto;
					padding: 12px;
					white-space: pre;
					width: 100%;
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
      <LexicalExtensionComposer
        extension={editorExtension}
        contentEditable={null}
      >
        <div className="keeper-editor-content" ref={setEditorContentElement}>
          <ContentEditable className="keeper-editor ContentEditable__root" />
          <EmptyPlaceholder />
        </div>
        <MarkdownShortcutPlugin transformers={KEEPER_MARKDOWN_TRANSFORMERS} />
      </LexicalExtensionComposer>
    </div>
  );
}
