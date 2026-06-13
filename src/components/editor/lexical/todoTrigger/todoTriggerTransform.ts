import { parseTodoTrigger } from "@/components/editor/lexical/todoTrigger/todoTrigger";
import { $createLinkNode, $isLinkNode } from "@lexical/link";
import {
  $createTextNode,
  $isElementNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
} from "lexical";
import { createWikiLinkUrl } from "../wikilinks/wikiLinkUrl";

export function convertTodoTriggerAtSelection(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return false;
  }

  const anchor = selection.anchor;
  const textNode = anchor.getNode();
  if (!$isTextNode(textNode)) {
    return false;
  }

  const parent = textNode.getParent();
  if (!$isElementNode(parent) || $isLinkNode(parent)) {
    return false;
  }

  if (parent.getChildrenSize() !== 1 || parent.getFirstChild() !== textNode) {
    return false;
  }

  if (anchor.offset !== textNode.getTextContentSize()) {
    return false;
  }

  const match = parseTodoTrigger(textNode.getTextContent());
  if (!match) {
    return false;
  }

  const prefix = `${match.keyword}${match.separator}`;
  const prefixNode = $createTextNode(prefix);
  prefixNode.setFormat(textNode.getFormat());

  const linkTextNode = $createTextNode(match.body);
  linkTextNode.setFormat(textNode.getFormat());

  const linkNode = $createLinkNode(createWikiLinkUrl(match.body));
  linkNode.append(linkTextNode);

  textNode.replace(prefixNode);
  prefixNode.insertAfter(linkNode);
  linkNode.selectNext();

  return true;
}

export function registerTodoTriggerTransform(editor: LexicalEditor) {
  return editor.registerCommand(
    KEY_ENTER_COMMAND,
    () => {
      convertTodoTriggerAtSelection();
      return false;
    },
    COMMAND_PRIORITY_LOW,
  );
}
