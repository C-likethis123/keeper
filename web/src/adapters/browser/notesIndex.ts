import { loadBrowserNotes } from "@web/ui/noteRepository";

export type NoteIndexItem = { noteId: string; title: string };
// biome-ignore lint/complexity/noStaticOnlyClass: Matches canonical NotesIndexService port.
export class NotesIndexService {
	static async listNotes(query: string, limit = 20) {
		const term = query.toLocaleLowerCase();
		const items = (await loadBrowserNotes()).filter((note) => `${note.title}\n${note.content}`.toLocaleLowerCase().includes(term)).slice(0, limit).map((note) => ({ noteId: note.id, title: note.title }));
		return { items, total: items.length, hasMore: false };
	}
}
