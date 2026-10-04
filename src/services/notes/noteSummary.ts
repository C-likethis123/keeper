export function extractSummary(markdown: string, maxLines = 6): string {
	const lines: string[] = [];
	let start = 0;

	for (let i = 0; i <= markdown.length; i += 1) {
		const atEnd = i === markdown.length;
		if (!atEnd && markdown[i] !== "\n") {
			continue;
		}

		let line = markdown.slice(start, i);
		if (line.endsWith("\r")) {
			line = line.slice(0, -1);
		}
		const trimmed = line.trim();
		if (trimmed.length > 0) {
			lines.push(trimmed);
			if (lines.length >= maxLines) {
				break;
			}
		}
		start = i + 1;
	}

	return lines.join("\n");
}
