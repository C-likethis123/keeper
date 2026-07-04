"use dom";

import { flushAllPendingEditorDispatches } from "@/components/editor/core/pendingDispatchRegistry";
import { darkTheme } from "@/constants/themes/darkTheme";
import { lightTheme } from "@/constants/themes/lightTheme";
import { writeEditorDraft } from "@/services/notes/editorDraftStore";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { NOTES_ROOT, setNotesRoot } from "@/services/notes/Notes";

import {
  $createRangeSelection,
  $getNodeByKey,
  $getRoot,
  $isTextNode,
  $setSelection,
  type LexicalEditor,
  type TextNode,
} from "lexical";
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
import { KEEPER_EDITOR_NODES } from "./keeperEditorNodes";
import { KEEPER_EDITOR_THEME } from "./keeperEditorTheme";

interface LexicalMarkdownEditorProps {
  command?: LexicalEditorCommand;
  dom?: import("expo/dom").DOMProps;
  hasAttachment?: boolean;
  isNativeDom?: boolean;
  keyboardHeight?: number;
  markdown: string;
  noteId: string;
  notesRoot?: string;
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

function getDomStyleHeight(dom?: LexicalMarkdownEditorProps["dom"]) {
  const style = dom?.style;
  if (!Array.isArray(style)) {
    return undefined;
  }
  for (const item of style) {
    if (item && typeof item === "object" && "height" in item) {
      return (item as { height?: unknown }).height;
    }
  }
  return undefined;
}

function safeAreaInsetsEqual(
  previous?: LexicalMarkdownEditorProps["safeAreaInsets"],
  next?: LexicalMarkdownEditorProps["safeAreaInsets"],
) {
  return (
    previous?.top === next?.top &&
    previous?.right === next?.right &&
    previous?.bottom === next?.bottom &&
    previous?.left === next?.left
  );
}

function domPropsEqual(
  previous?: LexicalMarkdownEditorProps["dom"],
  next?: LexicalMarkdownEditorProps["dom"],
) {
  return (
    previous?.allowingReadAccessToURL === next?.allowingReadAccessToURL &&
    previous?.scrollEnabled === next?.scrollEnabled &&
    getDomStyleHeight(previous) === getDomStyleHeight(next)
  );
}

function editorPropsEqual(
  previous: LexicalMarkdownEditorProps,
  next: LexicalMarkdownEditorProps,
) {
  return (
    previous.command === next.command &&
    previous.hasAttachment === next.hasAttachment &&
    previous.isNativeDom === next.isNativeDom &&
    previous.keyboardHeight === next.keyboardHeight &&
    previous.markdown === next.markdown &&
    previous.noteId === next.noteId &&
    previous.notesRoot === next.notesRoot &&
    previous.onAttachDocument === next.onAttachDocument &&
    previous.onInsertImage === next.onInsertImage &&
    previous.onInsertTemplateCommand === next.onInsertTemplateCommand &&
    previous.onMarkdownChange === next.onMarkdownChange &&
    previous.onOpenWikiLink === next.onOpenWikiLink &&
    previous.onRemoveAttachment === next.onRemoveAttachment &&
    previous.onShowVideoModal === next.onShowVideoModal &&
    previous.onToggleActivePanel === next.onToggleActivePanel &&
    previous.onToggleArticle === next.onToggleArticle &&
    previous.onToggleRelatedNotes === next.onToggleRelatedNotes &&
    previous.themeMode === next.themeMode &&
    safeAreaInsetsEqual(previous.safeAreaInsets, next.safeAreaInsets) &&
    domPropsEqual(previous.dom, next.dom)
  );
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

interface FindMatch {
  anchorKey: string;
  anchorOffset: number;
  focusKey: string;
  focusOffset: number;
}

interface TextSegment {
  end: number;
  node: TextNode;
  start: number;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveTextPoint(segments: TextSegment[], offset: number) {
  for (const segment of segments) {
    if (offset >= segment.start && offset <= segment.end) {
      return {
        key: segment.node.getKey(),
        offset: Math.min(offset - segment.start, segment.node.getTextContentSize()),
      };
    }
  }

  const lastSegment = segments[segments.length - 1];
  return lastSegment
    ? {
        key: lastSegment.node.getKey(),
        offset: lastSegment.node.getTextContentSize(),
      }
    : null;
}

function collectFindMatches(
  editor: LexicalEditor,
  query: string,
  matchCase: boolean,
) {
  if (!query) {
    return [];
  }

  const matches: FindMatch[] = [];
  editor.getEditorState().read(() => {
    const segments: TextSegment[] = [];
    let content = "";

    for (const node of $getRoot().getAllTextNodes()) {
      const text = node.getTextContent();
      if (!text) {
        continue;
      }
      const start = content.length;
      content += text;
      segments.push({ end: content.length, node, start });
    }

    if (!content || segments.length === 0) {
      return;
    }

    const flags = matchCase ? "g" : "gi";
    const expression = new RegExp(escapeRegex(query), flags);
    for (const match of content.matchAll(expression)) {
      const start = match.index ?? 0;
      const end = start + query.length;
      const anchor = resolveTextPoint(segments, start);
      const focus = resolveTextPoint(segments, end);
      if (!anchor || !focus) {
        continue;
      }
      matches.push({
        anchorKey: anchor.key,
        anchorOffset: anchor.offset,
        focusKey: focus.key,
        focusOffset: focus.offset,
      });
    }
  });

  return matches;
}

function findMatchesEqual(left: FindMatch[], right: FindMatch[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((match, index) => {
    const other = right[index];
    return (
      match.anchorKey === other.anchorKey &&
      match.anchorOffset === other.anchorOffset &&
      match.focusKey === other.focusKey &&
      match.focusOffset === other.focusOffset
    );
  });
}

function scrollSelectionIntoView() {
  requestAnimationFrame(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.height > 0 || rect.width > 0) {
      window.scrollBy({
        top: rect.top - window.innerHeight / 3,
        behavior: "smooth",
      });
    }
  });
}

function scrollFindMatchIntoView(
  editor: LexicalEditor,
  match: FindMatch | undefined,
) {
  if (!match) {
    return;
  }

  requestAnimationFrame(() => {
    editor.getElementByKey(match.anchorKey)?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });
  });
}

function selectFindMatch(
  editor: LexicalEditor,
  match: FindMatch | undefined,
  options: { focusEditor?: boolean } = { focusEditor: true },
) {
  if (!match) {
    return;
  }

  editor.update(() => {
    const anchorNode = $getNodeByKey(match.anchorKey);
    const focusNode = $getNodeByKey(match.focusKey);
    if (!$isTextNode(anchorNode) || !$isTextNode(focusNode)) {
      return;
    }

    const selection = $createRangeSelection();
    selection.setTextNodeRange(
      anchorNode,
      match.anchorOffset,
      focusNode,
      match.focusOffset,
    );
    $setSelection(selection);
  });
  if (options.focusEditor) {
    editor.focus();
  }
  scrollSelectionIntoView();
}

function replaceFindMatch(
  editor: LexicalEditor,
  match: FindMatch | undefined,
  replacement: string,
) {
  if (!match) {
    return;
  }

  editor.update(
    () => {
      const anchorNode = $getNodeByKey(match.anchorKey);
      const focusNode = $getNodeByKey(match.focusKey);
      if (!$isTextNode(anchorNode) || !$isTextNode(focusNode)) {
        return;
      }

      if (anchorNode.is(focusNode)) {
        const text = anchorNode.getTextContent();
        anchorNode.setTextContent(
          `${text.slice(0, match.anchorOffset)}${replacement}${text.slice(
            match.focusOffset,
          )}`,
        );
        return;
      }

      const firstText = anchorNode.getTextContent();
      const lastText = focusNode.getTextContent();
      anchorNode.setTextContent(
        `${firstText.slice(0, match.anchorOffset)}${replacement}${lastText.slice(
          match.focusOffset,
        )}`,
      );
      let nextSibling = anchorNode.getNextSibling();
      while (nextSibling && !nextSibling.is(focusNode)) {
        const current = nextSibling;
        nextSibling = current.getNextSibling();
        current.remove();
      }
      focusNode.remove();
    },
    { discrete: true },
  );
}

function FindReplaceBar({ command }: { command?: LexicalEditorCommand }) {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [matches, setMatches] = useState<FindMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement | null>(null);

  const refreshMatches = useCallback(() => {
    const nextMatches = collectFindMatches(editor, query, matchCase);
    setMatches((current) =>
      findMatchesEqual(current, nextMatches) ? current : nextMatches,
    );
    setActiveIndex((current) =>
      nextMatches.length === 0 ? 0 : Math.min(current, nextMatches.length - 1),
    );
  }, [editor, matchCase, query]);

  useEffect(() => {
    refreshMatches();
    return editor.registerUpdateListener(() => {
      refreshMatches();
    });
  }, [editor, refreshMatches]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, [isOpen]);

  useEffect(() => {
    if (command?.type !== "openFindReplace") {
      return;
    }
    setIsOpen(true);
    setIsReplaceOpen(command.payload?.replace === true);
  }, [command]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setIsOpen(true);
        if (event.shiftKey || event.altKey) {
          setIsReplaceOpen(true);
        }
        return;
      }

      if (!isOpen) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        editor.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [editor, isOpen]);

  const goToMatch = useCallback(
    (direction: 1 | -1) => {
      if (matches.length === 0) {
        return;
      }
      const nextIndex =
        (activeIndex + direction + matches.length) % matches.length;
      setActiveIndex(nextIndex);
      scrollFindMatchIntoView(editor, matches[nextIndex]);
    },
    [activeIndex, editor, matches],
  );

  const replaceCurrent = useCallback(() => {
    const match = matches[activeIndex];
    replaceFindMatch(editor, match, replacement);
    setTimeout(() => {
      const nextMatches = collectFindMatches(editor, query, matchCase);
      setMatches(nextMatches);
      setActiveIndex((current) =>
        nextMatches.length === 0 ? 0 : Math.min(current, nextMatches.length - 1),
      );
    }, 0);
  }, [activeIndex, editor, matchCase, matches, query, replacement]);

  const replaceAll = useCallback(() => {
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      replaceFindMatch(editor, matches[index], replacement);
    }
    setMatches([]);
    setActiveIndex(0);
  }, [editor, matches, replacement]);

  if (!isOpen) {
    return null;
  }

  const hasMatches = matches.length > 0;

  return (
    <div className="keeper-find-panel">
      <div className="keeper-find-row">
        <button
          aria-label={isReplaceOpen ? "Hide replace" : "Show replace"}
          className="keeper-find-icon-button"
          onClick={() => setIsReplaceOpen((value) => !value)}
          type="button"
        >
          {isReplaceOpen ? "⌄" : "›"}
        </button>
        <input
          ref={findInputRef}
          aria-label="Find"
          className="keeper-find-input"
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              goToMatch(event.shiftKey ? -1 : 1);
            }
          }}
          placeholder="Find"
          value={query}
        />
        <span className="keeper-find-count">
          {query ? (hasMatches ? `${activeIndex + 1}/${matches.length}` : "0/0") : ""}
        </span>
        <button
          aria-label="Match case"
          className={`keeper-find-text-button ${matchCase ? "keeper-find-active" : ""}`}
          onClick={() => setMatchCase((value) => !value)}
          type="button"
        >
          Aa
        </button>
        <button
          aria-label="Previous match"
          className="keeper-find-icon-button"
          disabled={!hasMatches}
          onClick={() => goToMatch(-1)}
          type="button"
        >
          ↑
        </button>
        <button
          aria-label="Next match"
          className="keeper-find-icon-button"
          disabled={!hasMatches}
          onClick={() => goToMatch(1)}
          type="button"
        >
          ↓
        </button>
        <button
          aria-label="Close find"
          className="keeper-find-icon-button"
          onClick={() => {
            setIsOpen(false);
            editor.focus();
          }}
          type="button"
        >
          ×
        </button>
      </div>
      {isReplaceOpen ? (
        <div className="keeper-find-row">
          <span className="keeper-find-spacer" />
          <input
            aria-label="Replace"
            className="keeper-find-input"
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                replaceCurrent();
              }
            }}
            placeholder="Replace"
            value={replacement}
          />
          <button
            className="keeper-find-replace-button"
            disabled={!hasMatches}
            onClick={replaceCurrent}
            type="button"
          >
            Replace
          </button>
          <button
            className="keeper-find-replace-button"
            disabled={!hasMatches}
            onClick={replaceAll}
            type="button"
          >
            All
          </button>
        </div>
      ) : null}
    </div>
  );
}

function useLatestGetter<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return useCallback(() => ref.current, []);
}

function LexicalMarkdownEditor({
  command,
  hasAttachment = false,
  isNativeDom = false,
  keyboardHeight = 0,
  markdown,
  noteId,
  notesRoot,
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
  if (notesRoot && NOTES_ROOT !== notesRoot) {
    setNotesRoot(notesRoot);
  }

  const palette = themeMode === "light" ? lightTheme.colors : darkTheme.colors;
  const editorContentElementRef = useRef<HTMLDivElement | null>(null);
  const initialMarkdownRef = useRef(markdown);
  const commandRef = useRef<LexicalEditorCommand | undefined>(command);
  const handleMarkdownChange = useCallback(
    (nextMarkdown: string) => {
      writeEditorDraft(noteId, nextMarkdown);
      onMarkdownChange(nextMarkdown);
    },
    [noteId, onMarkdownChange],
  );
  const getOnMarkdownChange = useLatestGetter(handleMarkdownChange);
  const getOnInsertTemplateCommand = useLatestGetter(onInsertTemplateCommand);
  const getOnOpenWikiLink = useLatestGetter(onOpenWikiLink);
  const getHasAttachment = useLatestGetter(hasAttachment ?? false);
  const getOnAttachDocument = useLatestGetter(onAttachDocument);
  const getOnInsertImage = useLatestGetter(onInsertImage);
  const getOnRemoveAttachment = useLatestGetter(onRemoveAttachment);
  const getOnShowVideoModal = useLatestGetter(onShowVideoModal);
  const getOnToggleActivePanel = useLatestGetter(onToggleActivePanel);
  const getOnToggleArticle = useLatestGetter(onToggleArticle);
  const getOnToggleRelatedNotes = useLatestGetter(onToggleRelatedNotes);
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

  const editorExtension = useMemo(
    () =>
      createKeeperEditorExtension({
        getCommand: () => commandRef.current,
        getDraggableBlockAnchorElem: () => editorContentElementRef.current,
        getOnInsertTemplateCommand,
        getOnMarkdownChange,
        getOnOpenWikiLink,
        getHasAttachment,
        getOnAttachDocument,
        getOnInsertImage,
        getOnRemoveAttachment,
        getOnShowVideoModal,
        getOnToggleActivePanel,
        getOnToggleArticle,
        getOnToggleRelatedNotes,
        nodes: KEEPER_EDITOR_NODES,
        editorState: () => importMarkdownToLexical(initialMarkdownRef.current),
        theme: KEEPER_EDITOR_THEME,
      }),
    [
      getHasAttachment,
      getOnAttachDocument,
      getOnInsertImage,
      getOnInsertTemplateCommand,
      getOnMarkdownChange,
      getOnOpenWikiLink,
      getOnRemoveAttachment,
      getOnShowVideoModal,
      getOnToggleActivePanel,
      getOnToggleArticle,
      getOnToggleRelatedNotes,
    ],
  );

  return (
    <div
      style={{
        background: palette.background,
        color: palette.text,
        height: isNativeDom ? "100vh" : "100%",
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
						padding: ${isNativeDom ? "0 18px 40px" : "18px 18px 40px"};
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
				.keeper-find-panel {
					background: ${palette.card};
					border: 1px solid ${palette.border};
					border-radius: 8px;
					box-shadow: 0 10px 28px ${palette.shadow}33;
					box-sizing: border-box;
					display: flex;
					flex-direction: column;
					gap: 6px;
					margin: 0 18px 8px auto;
					padding: 8px;
					position: sticky;
					top: ${Math.max((safeAreaInsets?.top ?? 0) + 14, 14)}px;
					width: min(520px, calc(100vw - 36px));
					z-index: 30;
				}
				.keeper-find-row {
					align-items: center;
					display: flex;
					gap: 6px;
					min-width: 0;
				}
				.keeper-find-input {
					background: ${palette.background};
					border: 1px solid ${palette.border};
					border-radius: 6px;
					box-sizing: border-box;
					color: ${palette.text};
					flex: 1;
					font: inherit;
					font-size: 14px;
					height: 32px;
					min-width: 0;
					outline: none;
					padding: 0 10px;
				}
				.keeper-find-input:focus {
					border-color: ${palette.primary};
					box-shadow: 0 0 0 2px ${palette.primary}33;
				}
				.keeper-find-count {
					color: ${palette.textSecondary};
					font-size: 12px;
					font-variant-numeric: tabular-nums;
					min-width: 44px;
					text-align: center;
				}
				.keeper-find-icon-button,
				.keeper-find-text-button,
				.keeper-find-replace-button {
					align-items: center;
					background: transparent;
					border: 1px solid transparent;
					border-radius: 6px;
					color: ${palette.text};
					cursor: pointer;
					display: inline-flex;
					font: inherit;
					font-size: 14px;
					height: 32px;
					justify-content: center;
					line-height: 1;
					padding: 0;
				}
				.keeper-find-icon-button {
					width: 32px;
				}
				.keeper-find-text-button {
					font-weight: 700;
					width: 34px;
				}
				.keeper-find-replace-button {
					background: ${palette.background};
					border-color: ${palette.border};
					padding: 0 10px;
					white-space: nowrap;
				}
				.keeper-find-icon-button:hover,
				.keeper-find-text-button:hover,
				.keeper-find-replace-button:hover,
				.keeper-find-active {
					background: ${palette.primary}1A;
					border-color: ${palette.primary}66;
				}
				.keeper-find-icon-button:disabled,
				.keeper-find-replace-button:disabled {
					cursor: default;
					opacity: 0.45;
				}
				.keeper-find-spacer {
					width: 32px;
				}
			`}</style>
      <LexicalExtensionComposer
        extension={editorExtension}
        contentEditable={null}
      >
        <FindReplaceBar command={command} />
        <div className="keeper-editor-content" ref={setEditorContentElement}>
          <ContentEditable className="keeper-editor ContentEditable__root" />
          <EmptyPlaceholder />
        </div>
        <MarkdownShortcutPlugin transformers={KEEPER_MARKDOWN_TRANSFORMERS} />
      </LexicalExtensionComposer>
    </div>
  );
}

export default React.memo(LexicalMarkdownEditor, editorPropsEqual);
