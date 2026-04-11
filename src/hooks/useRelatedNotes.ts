import {
	notesIndexDbGetBacklinks,
	notesIndexDbGetOutgoingLinks,
} from "@/services/notes/notesIndexDb";
import type { Note } from "@/services/notes/types";
import { NoteService } from "@/services/notes/noteService";
import { useEffect, useState } from "react";

export interface RelatedNotesResult {
	backlinks: Note[];
	outgoing: Note[];
	loading: boolean;
	error: string | null;
}

async function loadNotesByIds(ids: string[]): Promise<Note[]> {
	const notes: Note[] = [];
	for (const id of ids) {
		const note = await NoteService.loadNote(id);
		if (note) {
			notes.push(note);
		}
	}
	return notes;
}

export function useRelatedNotes(noteId: string): RelatedNotesResult {
	const [backlinks, setBacklinks] = useState<Note[]>([]);
	const [outgoing, setOutgoing] = useState<Note[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!noteId) {
			setBacklinks([]);
			setOutgoing([]);
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);

		Promise.all([
			notesIndexDbGetBacklinks(noteId),
			notesIndexDbGetOutgoingLinks(noteId),
		])
			.then(async ([backlinkIds, outgoingIds]) => {
				if (cancelled) return;
				const [backlinkNotes, outgoingNotes] = await Promise.all([
					loadNotesByIds(backlinkIds),
					loadNotesByIds(outgoingIds),
				]);
				if (cancelled) return;
				setBacklinks(backlinkNotes);
				setOutgoing(outgoingNotes);
			})
			.catch((err) => {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : String(err));
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [noteId]);

	return { backlinks, outgoing, loading, error };
}
