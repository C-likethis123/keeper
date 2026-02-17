import { normalizePath } from "@/services/git/expoFileSystemAdapter";
import { NOTES_ROOT } from "./Notes";

// TODO: since we're moving away from handling git, we don't need to normalise the paths.
// However we need to investigate if the file URI is different on web and mobile.
export function toAbsoluteNotesPath(filePath: string): string {
	const isRelative =
		!filePath.startsWith("/") && !filePath.startsWith("file://");
	if (!isRelative) return filePath;
	const root = NOTES_ROOT.endsWith("/") ? NOTES_ROOT.slice(0, -1) : NOTES_ROOT;
	const raw = `${root}/${filePath}`;
	return NOTES_ROOT.startsWith("file:") ? normalizePath(raw) : raw;
}
