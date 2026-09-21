import type { EditorTab } from "./tab-contract";

export function editorPath(tab: Pick<EditorTab, "noteId" | "isNew">): string {
	return tab.isNew ? `/editor?id=${tab.noteId}&isNew=true` : `/editor?id=${tab.noteId}`;
}
