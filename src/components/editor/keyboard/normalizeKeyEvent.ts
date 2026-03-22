export interface NormalizedKeyEvent {
	key: string;
	chord: string;
}

function normalizeKey(key: string, code: string): string {
	if (/^Key[A-Z]$/.test(code)) {
		return code.slice(3);
	}
	if (/^Digit[0-9]$/.test(code)) {
		return code.slice(5);
	}
	if (key === "Return") return "Enter";
	if (key.length === 1) return key.toUpperCase();
	return key;
}

export function normalizeKeyEvent(
	event: KeyboardEvent,
): NormalizedKeyEvent | null {
	const key = normalizeKey(event.key, event.code);
	if (["Meta", "Control", "Shift", "Alt"].includes(key)) {
		return null;
	}

	const modifiers: string[] = [];
	if (event.metaKey) modifiers.push("Meta");
	if (event.ctrlKey) modifiers.push("Ctrl");
	if (event.altKey) modifiers.push("Alt");
	if (event.shiftKey) modifiers.push("Shift");

	return {
		key,
		chord: [...modifiers, key].join("+"),
	};
}
