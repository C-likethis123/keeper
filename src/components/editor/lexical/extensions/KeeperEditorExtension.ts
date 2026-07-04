import {
  AutoFocusExtension,
  TabIndentationExtension,
} from "@lexical/extension";
import { CodePrismExtension } from "@lexical/code-prism";
import { HistoryExtension } from "@lexical/history";
import { CheckListExtension, ListExtension } from "@lexical/list";
import { LinkExtension } from "@lexical/link";
import { RichTextExtension } from "@lexical/rich-text";
import { TableExtension } from "@lexical/table";
import {
  type CreateEditorArgs,
  type EditorThemeClasses,
  type InitialEditorStateType,
  configExtension,
  defineExtension,
} from "lexical";
import { ChecklistMarkdownPrefixExtension } from "../lists/ChecklistMarkdownPrefixExtension";
import { CodeBlockExtension } from "../codeBlock/CodeBlockExtension";
import {
  CommandExtension,
  type LexicalEditorCommand,
} from "./CommandExtension";
import { createDraggableBlockExtension } from "./DraggableBlockExtension";
import { InlineCodeMarkdownExitExtension } from "../codeBlock/InlineCodeMarkdownExitExtension";
import { MarkdownPasteExtension } from "./MarkdownPasteExtension";
import { createMarkdownChangeExtension } from "./MarkdownChangeExtension";
import { TodoTriggerExtension } from "../todoTrigger/TodoTriggerExtension";
import { EquationExtension } from "../equations/EquationExtension";
import { SlashCommandExtension } from "../slashCommand/SlashCommandExtension";
import { ToolbarExtension } from "../toolbar/LexicalToolbarExtension";
import { WikiLinkExtension } from "../wikilinks/WikiLinkExtension";
import { KeeperTableControlsExtension } from "./KeeperTableControlsExtension";

interface CreateKeeperEditorExtensionOptions {
  editorState: InitialEditorStateType;
  getCommand: () => LexicalEditorCommand | undefined;
  getDraggableBlockAnchorElem: () => HTMLElement | null;
  getOnMarkdownChange: () => (markdown: string) => void;
  getOnInsertTemplateCommand: () => (() => void | Promise<void>) | undefined;
  getOnOpenWikiLink: () =>
    | ((title: string) => void | Promise<void>)
    | undefined;
  getHasAttachment: () => boolean;
  getOnAttachDocument: () => (() => void) | undefined;
  getOnInsertImage: () => (() => void) | undefined;
  getOnRemoveAttachment: () => (() => void) | undefined;
  getOnShowVideoModal: () => (() => void) | undefined;
  getOnToggleArticle: () => (() => void) | undefined;
  getOnToggleRelatedNotes: () => (() => void) | undefined;
  getOnToggleActivePanel: () => (() => void) | undefined;
  nodes: CreateEditorArgs["nodes"];
  theme: EditorThemeClasses;
}

export function createKeeperEditorExtension({
  editorState,
  getCommand,
  getDraggableBlockAnchorElem,
  getOnInsertTemplateCommand,
  getOnMarkdownChange,
  getOnOpenWikiLink,
  getHasAttachment,
  getOnAttachDocument,
  getOnInsertImage,
  getOnRemoveAttachment,
  getOnShowVideoModal,
  getOnToggleArticle,
  getOnToggleRelatedNotes,
  getOnToggleActivePanel,
  nodes,
  theme,
}: CreateKeeperEditorExtensionOptions) {
  return defineExtension({
    name: "keeper/editor",
    namespace: "KeeperLexicalEditor",
    nodes,
    theme,
    $initialEditorState: editorState,
    onError(error: Error) {
      throw error;
    },
    dependencies: [
      configExtension(AutoFocusExtension, {
        defaultSelection: "rootEnd",
        disabled: false,
      }),
      configExtension(HistoryExtension, {
        delay: 300,
        disabled: false,
        maxDepth: null,
      }),
      configExtension(ListExtension, {
        hasStrictIndent: false,
        shouldPreserveNumbering: false,
      }),
      configExtension(CheckListExtension, {
        disableTakeFocusOnClick: false,
      }),
      configExtension(LinkExtension, {
        attributes: undefined,
        validateUrl: undefined,
      }),
      configExtension(TableExtension, {
        hasCellBackgroundColor: true,
        hasCellMerge: true,
        hasHorizontalScroll: true,
        hasNestedTables: false,
        hasTabHandler: true,
      }),
      configExtension(TabIndentationExtension, {
        $canIndent: (node) => node.canIndent(),
        disabled: false,
        maxIndent: null,
      }),
      MarkdownPasteExtension,
      RichTextExtension,
      CodePrismExtension,
      ChecklistMarkdownPrefixExtension,
      CodeBlockExtension,
      EquationExtension,
      TodoTriggerExtension,
      InlineCodeMarkdownExitExtension,
      configExtension(CommandExtension, { getCommand }),
      configExtension(SlashCommandExtension, { getOnInsertTemplateCommand }),
      configExtension(WikiLinkExtension, { getOnOpenWikiLink }),
      configExtension(ToolbarExtension, {
        getHasAttachment,
        getOnAttachDocument,
        getOnInsertImage,
        getOnRemoveAttachment,
        getOnShowVideoModal,
        getOnToggleActivePanel,
        getOnToggleArticle,
        getOnToggleRelatedNotes,
      }),
      KeeperTableControlsExtension,
      createDraggableBlockExtension({
        getAnchorElem: getDraggableBlockAnchorElem,
      }),
      createMarkdownChangeExtension({ getOnMarkdownChange }),
    ],
  });
}
