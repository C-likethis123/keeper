/// Finds the start position of a slash-command trigger before the caret.
/// Returns null if no trigger is found.
export function findSlashCommandTriggerStart(
	text: string,
	caret: number,
): number | null {
	if (caret < 1) return null;

	const beforeCaret = text.slice(0, caret);
	const slashIndex = beforeCaret.lastIndexOf("/");

	if (slashIndex < 0) return null;

	const previousChar = slashIndex > 0 ? text[slashIndex - 1] : "";
	if (previousChar !== "" && !/\s/.test(previousChar)) {
		return null;
	}

	const query = text.slice(slashIndex + 1, caret);
	if (/\s/.test(query)) {
		return null;
	}

	return slashIndex;
}
