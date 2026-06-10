"use dom";

import {
	$isCodeNode,
	type CodeNode,
	registerCodeHighlighting,
} from "@lexical/code";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
	$createTextNode,
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_HIGH,
	CONTROLLED_TEXT_INSERTION_COMMAND,
	DELETE_CHARACTER_COMMAND,
	KEY_DOWN_COMMAND,
	KEY_ENTER_COMMAND,
	KEY_TAB_COMMAND,
} from "lexical";
import type React from "react";
import { useEffect } from "react";
import {
	handleBackspace,
	handleCodeTextInsertion,
	handleEnter,
	type SmartEditResult,
	handleTab,
} from "./codeBlockSmartEdit";

interface CodeSelectionContext {
	codeNode: CodeNode;
	cursorOffset: number;
	selection: ReturnType<typeof $getSelection>;
	text: string;
}

function getCodeSelectionContext(): CodeSelectionContext | null {
	const selection = $getSelection();
	if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
		return null;
	}

	const anchor = selection.anchor;
	const anchorNode = anchor.getNode();
	const topLevelNode = anchorNode.getTopLevelElementOrThrow();
	if (!$isCodeNode(topLevelNode)) {
		return null;
	}

	const cursorOffset =
		anchor.type === "element"
			? topLevelNode
					.getChildren()
					.slice(0, anchor.offset)
					.reduce((offset, child) => offset + child.getTextContentSize(), 0)
			: anchorNode
					.getPreviousSiblings()
					.reduce((offset, sibling) => offset + sibling.getTextContentSize(), 0) +
				anchor.offset;

	return {
		codeNode: topLevelNode,
		cursorOffset,
		selection,
		text: topLevelNode.getTextContent(),
	};
}

function replaceCodeText(
	codeNode: CodeNode,
	nextText: string,
	nextCursorOffset: number,
) {
	const textNode = $createTextNode(nextText);
	codeNode.clear();
	codeNode.append(textNode);
	textNode.select(nextCursorOffset, nextCursorOffset);
}

function handleSmartEditResult(
	ctx: CodeSelectionContext,
	result: SmartEditResult,
) {
	if (!result.handled) {
		return false;
	}
	replaceCodeText(ctx.codeNode, result.newText, result.newCursorOffset);
	return true;
}

export function LexicalCodeBlockPlugin(): React.ReactElement | null {
	const [editor] = useLexicalComposerContext();

	useEffect(() => registerCodeHighlighting(editor), [editor]);

	useEffect(() => {
		return editor.registerCommand(
			KEY_TAB_COMMAND,
			(event: KeyboardEvent) => {
				const ctx = getCodeSelectionContext();
				if (!ctx) {
					return false;
				}

				event.preventDefault();
				const result = handleTab(ctx.text, ctx.cursorOffset, event.shiftKey);
				return handleSmartEditResult(ctx, result);
			},
			COMMAND_PRIORITY_HIGH,
		);
	}, [editor]);

	useEffect(() => {
		return editor.registerCommand(
			KEY_ENTER_COMMAND,
			(event: KeyboardEvent | null) => {
				const ctx = getCodeSelectionContext();
				if (!ctx) {
					return false;
				}

				event?.preventDefault();
				const result = handleEnter(ctx.text, ctx.cursorOffset);
				return handleSmartEditResult(ctx, result);
			},
			COMMAND_PRIORITY_HIGH,
		);
	}, [editor]);

	useEffect(() => {
		return editor.registerCommand(
			CONTROLLED_TEXT_INSERTION_COMMAND,
			(payload: InputEvent | string) => {
				const insertedText =
					typeof payload === "string" ? payload : (payload.data ?? "");
				if (insertedText.length !== 1) {
					return false;
				}

				const ctx = getCodeSelectionContext();
				if (!ctx) {
					return false;
				}

				const result = handleCodeTextInsertion(
					ctx.text,
					ctx.cursorOffset,
					insertedText,
				);
				return handleSmartEditResult(ctx, result);
			},
			COMMAND_PRIORITY_HIGH,
		);
	}, [editor]);

	useEffect(() => {
		return editor.registerCommand(
			KEY_DOWN_COMMAND,
			(event: KeyboardEvent) => {
				if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) {
					return false;
				}

				const ctx = getCodeSelectionContext();
				if (!ctx) {
					return false;
				}

				const result = handleCodeTextInsertion(ctx.text, ctx.cursorOffset, event.key);
				if (!result.handled) {
					return false;
				}

				event.preventDefault();
				return handleSmartEditResult(ctx, result);
			},
			COMMAND_PRIORITY_HIGH,
		);
	}, [editor]);

	useEffect(() => {
		return editor.registerCommand(
			DELETE_CHARACTER_COMMAND,
			(isBackward: boolean) => {
				if (!isBackward) {
					return false;
				}

				const ctx = getCodeSelectionContext();
				if (!ctx) {
					return false;
				}

				const result = handleBackspace(ctx.text, ctx.cursorOffset);
				if (!result.handled) {
					return false;
				}

				replaceCodeText(ctx.codeNode, result.newText, result.newCursorOffset);
				return true;
			},
			COMMAND_PRIORITY_HIGH,
		);
	}, [editor]);

	return null;
}
