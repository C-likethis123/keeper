import {
  registerPendingDispatchFlusher,
  unregisterPendingDispatchFlusher,
} from "@/components/editor/core/pendingDispatchRegistry";
import {
  BlockType,
  type EditorBlockPayload,
  getBlockLanguage,
} from "@/components/editor/utils/blockTypes";
import { $createCodeNode } from "@lexical/code";
import {
  $createListItemNode,
  $createListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { $createHeadingNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  INDENT_CONTENT_COMMAND,
  type LexicalEditor,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  $parseSerializedNode,
  safeCast,
  UNDO_COMMAND,
  defineExtension,
} from "lexical";
import { $createImageNode } from "../image/ImageNode";
import { importMarkdownToLexical, parseMarkdownToSerializedNodes } from "../markdown";

export interface LexicalEditorCommand {
  type: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}

interface CommandExtensionConfig {
  getCommand: () => LexicalEditorCommand | undefined;
}

export const CommandExtension = defineExtension({
  config: safeCast<CommandExtensionConfig>({
    getCommand: () => undefined,
  }),
  name: "keeper/Command",
  register(editor, config) {
    let lastTimestamp: number | null = null;

    const dispatchCommand = () => {
      const command = config.getCommand();
      if (!command || command.timestamp === lastTimestamp) {
        return;
      }
      lastTimestamp = command.timestamp;

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
    };

    const key = `lexical-command-${editor.getKey()}`;
    registerPendingDispatchFlusher(key, dispatchCommand);
    dispatchCommand();

    return () => {
      unregisterPendingDispatchFlusher(key, dispatchCommand);
    };
  },
});

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
  const serializedNodes = parseMarkdownToSerializedNodes(markdown);
  if (serializedNodes.length === 0) return;

  editor.update(
    () => {
      $insertNodes(serializedNodes.map((node) => $parseSerializedNode(node)));
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
      const paragraphNode = $createParagraphNode();
      const selection = $getSelection();

      if ($isRangeSelection(selection)) {
        $insertNodes([imageNode]);
        imageNode.insertAfter(paragraphNode);
        paragraphNode.selectStart();
        return;
      }

      $getRoot().append(imageNode, paragraphNode);
      paragraphNode.selectStart();
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
