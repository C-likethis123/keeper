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
	KEY_ENTER_COMMAND,
	KEY_TAB_COMMAND,
} from "lexical";
import type React from "react";
import { useEffect } from "react";

interface CodeSelectionContext {
	codeNode: CodeNode;
	cursorOffset: number;
	selection: ReturnType<typeof $getSelection>;
	text: string;
}

interface SmartEditResult {
	handled: boolean;
	newCursorOffset: number;
	newText: string;
}

const INDENT = "\t";

function getLineBeforeCursor(text: string, cursorOffset: number) {
	const lineStart = text.lastIndexOf("\n", cursorOffset - 1) + 1;
	return text.slice(lineStart, cursorOffset);
}

function getLineIndent(text: string) {
	return text.match(/^\s*/)?.[0] ?? "";
}

function insertTextAtCursor(
	text: string,
	cursorOffset: number,
	insertedText: string,
): SmartEditResult {
	return {
		handled: true,
		newCursorOffset: cursorOffset + insertedText.length,
		newText: text.slice(0, cursorOffset) + insertedText + text.slice(cursorOffset),
	};
}

function handleTab(
	text: string,
	cursorOffset: number,
	shouldOutdent: boolean,
): SmartEditResult {
	if (!shouldOutdent) {
		return insertTextAtCursor(text, cursorOffset, INDENT);
	}

	const lineBeforeCursor = getLineBeforeCursor(text, cursorOffset);
	if (lineBeforeCursor.endsWith(INDENT)) {
		return {
			handled: true,
			newCursorOffset: cursorOffset - INDENT.length,
			newText:
				text.slice(0, cursorOffset - INDENT.length) + text.slice(cursorOffset),
		};
	}

	return { handled: false, newCursorOffset: cursorOffset, newText: text };
}

function handleEnter(text: string, cursorOffset: number): SmartEditResult {
	const lineBeforeCursor = getLineBeforeCursor(text, cursorOffset);
	const baseIndent = getLineIndent(lineBeforeCursor);
	const extraIndent = /[{[(]\s*$/.test(lineBeforeCursor) ? INDENT : "";
	return insertTextAtCursor(text, cursorOffset, `\n${baseIndent}${extraIndent}`);
}

function handleBackspace(text: string, cursorOffset: number): SmartEditResult {
	if (cursorOffset < INDENT.length) {
		return { handled: false, newCursorOffset: cursorOffset, newText: text };
	}

	const lineBeforeCursor = getLineBeforeCursor(text, cursorOffset);
	if (!lineBeforeCursor.endsWith(INDENT)) {
		return { handled: false, newCursorOffset: cursorOffset, newText: text };
	}

	return {
		handled: true,
		newCursorOffset: cursorOffset - INDENT.length,
		newText: text.slice(0, cursorOffset - INDENT.length) + text.slice(cursorOffset),
	};
}

function getCodeSelectionContext(): CodeSelectionContext | null {
	const selection = $getSelection();
	if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
		return null;
	}

	const anchorNode = selection.anchor.getNode();
	const topLevelNode = anchorNode.getTopLevelElementOrThrow();
	if (!$isCodeNode(topLevelNode)) {
		return null;
	}

	let cursorOffset = 0;
	for (const textNode of topLevelNode.getAllTextNodes()) {
		if (textNode.getKey() === anchorNode.getKey()) {
			cursorOffset += selection.anchor.offset;
			break;
		}
		cursorOffset += textNode.getTextContentSize();
	}

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

				return false;
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
