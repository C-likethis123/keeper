import NoteRelatedNotes from "@keeper/components/moc/NoteRelatedNotes";
import { parseWikiLinksFromBody } from "@keeper/services/notes/wikiLinkParser";
import type { BrowserNote } from "@web/ui/noteRepository";
import { useMemo } from "react";

function normal(title: string) { return title.trim().toLocaleLowerCase(); }

/** Browser data adapter around canonical Expo related-notes presentation. */
export function BrowserRelatedNotes({ note, notes, onNavigate }: { note: BrowserNote; notes: BrowserNote[]; onNavigate: (id: string) => void }) {
	const { backlinks, outgoing } = useMemo(() => {
		const byTitle = new Map(notes.map((item) => [normal(item.title), item]));
		const outgoing = parseWikiLinksFromBody(note.content).map((title) => byTitle.get(normal(title))).filter((item): item is BrowserNote => Boolean(item));
		const backlinks = notes.filter((item) => item.id !== note.id && parseWikiLinksFromBody(item.content).some((title) => normal(title) === normal(note.title)));
		return { backlinks, outgoing };
	}, [note, notes]);
	return <NoteRelatedNotes backlinks={backlinks} outgoing={outgoing} loading={false} onNavigate={onNavigate} />;
}
