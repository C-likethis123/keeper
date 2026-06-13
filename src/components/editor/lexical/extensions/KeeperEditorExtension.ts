import {
	AutoFocusExtension,
	TabIndentationExtension,
} from "@lexical/extension";
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
import {
	ChecklistMarkdownPrefixExtension,
	CommandExtension,
	type LexicalEditorCommand,
	InlineCodeMarkdownExitExtension,
	TodoTriggerExtension,
	createDraggableBlockExtension,
	createMarkdownChangeExtension,
} from ".";
import { WikiLinkExtension } from "../wikilinks/LexicalWikiLinkPlugin";

interface CreateKeeperEditorExtensionOptions {
	editorState: InitialEditorStateType;
	getCommand: () => LexicalEditorCommand | undefined;
	getDraggableBlockAnchorElem: () => HTMLElement | null;
	getOnMarkdownChange: () => (markdown: string) => void;
	getOnOpenWikiLink: () => ((title: string) => void | Promise<void>) | undefined;
	nodes: CreateEditorArgs["nodes"];
	theme: EditorThemeClasses;
}

export function createKeeperEditorExtension({
	editorState,
	getCommand,
	getDraggableBlockAnchorElem,
	getOnMarkdownChange,
	getOnOpenWikiLink,
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
			RichTextExtension,
			ChecklistMarkdownPrefixExtension,
			TodoTriggerExtension,
			InlineCodeMarkdownExitExtension,
			configExtension(CommandExtension, { getCommand }),
			configExtension(WikiLinkExtension, { getOnOpenWikiLink }),
			createDraggableBlockExtension({
				getAnchorElem: getDraggableBlockAnchorElem,
			}),
			createMarkdownChangeExtension({ getOnMarkdownChange }),
		],
	});
}
