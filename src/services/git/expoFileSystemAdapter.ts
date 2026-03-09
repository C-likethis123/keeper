const MODE_FILE = 0o644;

/** Normalizes a path to a valid file URI (encodes |, spaces, etc.). Use before passing to expo-file-system File/Directory. */
export function normalizePath(path: string): string {
	let pathPart = path.replace(/^file:\/\/?\/?/, "") || "/";
	if (!pathPart.startsWith("/")) pathPart = `/${pathPart}`;
	const decoded = pathPart.includes("%") ? decodeURI(pathPart) : pathPart;
	return `file://${encodeURI(decoded)}`;
}

function errWithCode(message: string, code: string): Error {
	const e = new Error(message);
	(e as Error & { code: string }).code = code;
	return e;
}
