import { normalizePath } from "@/services/git/expoFileSystemAdapter";
import { NOTES_ROOT } from "./Notes";

export function toAbsoluteNotesPath(idOrPath: string): string {
	const path = idOrPath.endsWith(".md") ? idOrPath : `${idOrPath}.md`;
	const raw = `${NOTES_ROOT}/${path}`;
	return NOTES_ROOT.startsWith("file:") ? normalizePath(raw) : raw;
}
