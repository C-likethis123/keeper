import { PAGE_SIZE } from "@/constants/pagination";
import { NoteService } from "@/services/notes/noteService";
import {
	type ListNotesResult,
	type NoteIndexItem,
	NotesIndexService,
} from "@/services/notes/notesIndex";
import type { Note } from "@/services/notes/types";
import { create } from "zustand";

export interface NoteListEntry {
	ids: string[];
	cursor?: { offset: number };
	hasMore: boolean;
}

export function listKeyFromQuery(query: string): string {
	return query.trim();
}

const DEFAULT_NOTE: Note = {
	id: "",
	title: "",
	content: "",
	lastUpdated: 0,
	isPinned: false,
};
export function getNoteById(state: NoteStore, id: string): Note {
	return state.notes[id] ?? DEFAULT_NOTE;
}

const EMPTY_LIST_ENTRY: NoteListEntry = { ids: [], hasMore: false };
export function getNotesEntry(
	state: NoteStore,
	listKey: string,
): NoteListEntry {
	const entry = state.noteLists[listKey];
	if (!entry) return EMPTY_LIST_ENTRY;
	return entry;
}

export function getNotesForList(state: NoteStore, listKey: string): Note[] {
	const entry = state.noteLists[listKey];
	if (!entry) return [];
	return entry.ids
		.map((id) => state.notes[id])
		.filter((n): n is Note => n != null);
}

const toNote = (item: NoteIndexItem): Note => {
	return {
		id: item.noteId,
		title: item.title,
		content: item.summary,
		lastUpdated: item.updatedAt,
		isPinned: item.isPinned,
	};
};

interface NoteStore {
	notes: Record<string, Note>;
	noteLists: Record<string, NoteListEntry>;
	loadNote: (id: string) => Promise<Note | null>;
	saveNote: (note: Note) => Promise<Note>;
	deleteNote: (id: string) => Promise<void>;
	fetchList: (
		listKey: string,
		options?: { append?: boolean },
	) => Promise<ListNotesResult>;
	clearCache: () => void;
}

/**
 * This is the service used by business level code to interact with notes and the notes cache.
 * It will call methods to update the application cache and the persistence layer. Business level code should not touch these internal layers,
 * and only use this service to interact with notes.
 */
export const useNoteStore = create<NoteStore>((set, get) => ({
	notes: {},
	noteLists: {},

	loadNote: async (id: string) => {
		const note = await NoteService.loadNote(id);
		if (note) {
			set({ notes: { ...get().notes, [id]: note } });
		}
		return note;
	},

	saveNote: async (note: Note) => {
		const saved = await NoteService.saveNote(note);
		const { notes, noteLists } = get();
		const nextNotes = { ...notes, [saved.id]: saved };
		const nextLists = { ...noteLists };
		for (const key of Object.keys(nextLists)) {
			if (nextLists[key].ids.includes(saved.id)) {
				nextLists[key] = { ids: [], hasMore: true };
			}
		}
		set({ notes: nextNotes, noteLists: nextLists });
		return saved;
	},

	deleteNote: async (id: string) => {
		const success = await NoteService.deleteNote(id);
		if (!success) throw new Error("Failed to delete note");
		const notes = { ...get().notes };
		delete notes[id];
		const noteLists = { ...get().noteLists };
		for (const key of Object.keys(noteLists)) {
			noteLists[key] = {
				...noteLists[key],
				ids: noteLists[key].ids.filter((n) => n !== id),
			};
		}
		set({ notes, noteLists });
	},

	fetchList: async (listKey: string, options?: { append?: boolean }) => {
		const { notes, noteLists } = get();
		const append = options?.append ?? false;
		const offset = append ? (noteLists[listKey]?.cursor?.offset ?? 0) : 0;
		const results = await NotesIndexService.listNotes(
			PAGE_SIZE,
			offset,
			listKey,
		);
		const newNotes = results.items.map(toNote);
		const newIds = newNotes.map((n) => n.id);
		const newNotesMap = newNotes.reduce<Record<string, Note>>((acc, note) => {
			acc[note.id] = note;
			return acc;
		}, {});
		const existing = noteLists[listKey];
		const ids = append && existing ? [...existing.ids, ...newIds] : newIds;
		const entry: NoteListEntry = {
			ids,
			cursor: results.cursor,
			hasMore: !!results.cursor,
		};
		set({
			notes: { ...notes, ...newNotesMap },
			noteLists: { ...noteLists, [listKey]: entry },
		});
		return results;
	},

	clearCache: () => set({ notes: {}, noteLists: {} }),
}));
