/** Normalizes a path to a valid file URI (encodes |, spaces, etc.). Use before passing to expo-file-system File/Directory. */
export function normalizePath(path: string): string {
	let pathPart = path.replace(/^file:\/\/?\/?/, "") || "/";
	if (!pathPart.startsWith("/")) pathPart = `/${pathPart}`;
	const decoded = pathPart.includes("%") ? decodeURI(pathPart) : pathPart;
	return `file://${encodeURI(decoded)}`;
}

/** Converts a file:// URI to an absolute filesystem path for Rust git bridge operations.
 * Rust git_core (libgit2) expects absolute paths, not file:// URIs.
 */
export function uriToGitPath(uri: string): string {
	// Remove file:// or file:/// prefix
	let path = uri.replace(/^file:\/\//, "");
	// Ensure leading slash for absolute paths
	if (!path.startsWith("/")) {
		path = `/${path}`;
	}
	return path;
}
