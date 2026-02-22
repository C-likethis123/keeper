import { normalizePath } from "@/services/git/expoFileSystemAdapter";
import { Paths } from "expo-file-system";
import { NOTES_ROOT } from "./Notes";

export function toAbsoluteNotesPath(idOrPath: string): string {
	const path = idOrPath.endsWith(".md") ? idOrPath : `${idOrPath}.md`;
	const raw = Paths.join(NOTES_ROOT, path);
	return NOTES_ROOT.startsWith("file:") ? normalizePath(raw) : raw;
}
