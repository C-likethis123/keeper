/// Finds the start position of a wiki link trigger before the caret.
/// Returns null if no trigger is found.
export function findWikiLinkTriggerStart(
	text: string,
	caret: number,
): number | null {
	if (caret < 2) return null;
	const index = text.lastIndexOf("[[", caret - 1);
	if (index < 0) return null;
	// If a closing ]] exists between [[ and the caret, the link is already complete
	const closing = text.indexOf("]]", index + 2);
	if (closing !== -1 && closing < caret) return null;
	return index;
}
