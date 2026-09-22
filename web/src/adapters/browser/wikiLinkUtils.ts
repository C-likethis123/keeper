import {
	NotesIndexService,
	type NoteIndexItem,
} from "@web/adapters/browser/notesIndex";
import { createBrowserLinkedNote } from "@web/ui/noteRepository";

export function findExactWikiLinkMatch(items: NoteIndexItem[], title: string) {
	const query = title.trim().toLocaleLowerCase();
	return (
		items.find((item) => item.title.trim().toLocaleLowerCase() === query) ??
		null
	);
}
export async function resolveOrCreateWikiLinkNoteId(title: string) {
	const query = title.trim();
	if (!query) return null;
	const result = await NotesIndexService.listNotes(query, 50);
	return (
		findExactWikiLinkMatch(result.items, query)?.noteId ??
		(await createBrowserLinkedNote(query))?.id ??
		null
	);
}
export function shouldOpenWikiLink(
	platform: string,
	event?: {
		metaKey?: boolean;
		ctrlKey?: boolean;
		nativeEvent?: { metaKey?: boolean; ctrlKey?: boolean };
	},
) {
	return (
		platform !== "web" ||
		Boolean(
			event?.metaKey ||
				event?.ctrlKey ||
				event?.nativeEvent?.metaKey ||
				event?.nativeEvent?.ctrlKey,
		)
	);
}
