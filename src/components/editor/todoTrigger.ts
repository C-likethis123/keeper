interface TodoTriggerMatch {
	keyword: string;
	body: string;
	separator: string;
}

export function parseTodoTrigger(text: string): TodoTriggerMatch | null {
	const match = /^\s*(todo)(:?)(\s+)(.+)\s*$/i.exec(text);
	const body = match?.[4]?.trim();
	if (!match || !body) {
		return null;
	}

	return {
		keyword: match[1],
		separator: `${match[2]}${match[3]}`,
		body,
	};
}
