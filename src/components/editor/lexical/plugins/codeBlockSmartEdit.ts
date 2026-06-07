export interface SmartEditResult {
	handled: boolean;
	newCursorOffset: number;
	newText: string;
}

const INDENT = "\t";

const PAIRS: Record<string, string> = {
	"(": ")",
	"[": "]",
	"{": "}",
};

const CLOSING_CHARS = new Set(Object.values(PAIRS));

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

export function handleTab(
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

export function handleEnter(text: string, cursorOffset: number): SmartEditResult {
	const lineBeforeCursor = getLineBeforeCursor(text, cursorOffset);
	const baseIndent = getLineIndent(lineBeforeCursor);
	const extraIndent = /[{[(]\s*$/.test(lineBeforeCursor) ? INDENT : "";
	return insertTextAtCursor(text, cursorOffset, `\n${baseIndent}${extraIndent}`);
}

export function handleBackspace(
	text: string,
	cursorOffset: number,
): SmartEditResult {
	const previousChar = text[cursorOffset - 1];
	const nextChar = text[cursorOffset];
	if (previousChar && PAIRS[previousChar] === nextChar) {
		return {
			handled: true,
			newCursorOffset: cursorOffset - 1,
			newText: text.slice(0, cursorOffset - 1) + text.slice(cursorOffset + 1),
		};
	}

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

export function handleCodeTextInsertion(
	text: string,
	cursorOffset: number,
	insertedText: string,
): SmartEditResult {
	const closingChar = PAIRS[insertedText];
	if (closingChar) {
		return {
			handled: true,
			newCursorOffset: cursorOffset + 1,
			newText:
				text.slice(0, cursorOffset) +
				insertedText +
				closingChar +
				text.slice(cursorOffset),
		};
	}

	if (CLOSING_CHARS.has(insertedText) && text[cursorOffset] === insertedText) {
		return {
			handled: true,
			newCursorOffset: cursorOffset + 1,
			newText: text,
		};
	}

	return { handled: false, newCursorOffset: cursorOffset, newText: text };
}
