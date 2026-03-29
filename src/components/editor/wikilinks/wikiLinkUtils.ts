import { PAGE_SIZE } from "@/constants/pagination";
import { NoteService } from "@/services/notes/noteService";
import {
	type NoteIndexItem,
	NotesIndexService,
} from "@/services/notes/notesIndex";
import { nanoid } from "nanoid";

export interface WikiLinkActivationEvent {
	nativeEvent?: {
		metaKey?: boolean;
		ctrlKey?: boolean;
	};
	stopPropagation?: () => void;
	preventDefault?: () => void;
}

export function normalizeWikiLinkTitle(title: string): string {
	return title.trim().toLocaleLowerCase();
}

export function findExactWikiLinkMatch(
	items: NoteIndexItem[],
	title: string,
): NoteIndexItem | null {
	const normalizedTitle = normalizeWikiLinkTitle(title);
	if (normalizedTitle.length === 0) {
		return null;
	}

	return (
		items.find(
			(item) => normalizeWikiLinkTitle(item.title) === normalizedTitle,
		) ?? null
	);
}

export async function resolveWikiLinkNoteId(
	title: string,
): Promise<string | null> {
	const query = title.trim();
	if (query.length === 0) {
		return null;
	}

	const result = await NotesIndexService.listNotes(query, PAGE_SIZE, 0);
	return findExactWikiLinkMatch(result.items, query)?.noteId ?? null;
}

export async function resolveOrCreateWikiLinkNoteId(
	title: string,
): Promise<string | null> {
	const query = title.trim();
	if (query.length === 0) {
		return null;
	}

	const existingNoteId = await resolveWikiLinkNoteId(query);
	if (existingNoteId) {
		return existingNoteId;
	}

	const created = await NoteService.saveNote(
		{
			id: nanoid(),
			title: query,
			content: "",
			isPinned: false,
			noteType: "note",
		},
		true,
	);

	return created.id;
}

export function shouldOpenWikiLink(
	platformOs: string,
	event?: WikiLinkActivationEvent,
): boolean {
	if (platformOs !== "web") {
		return true;
	}

	return Boolean(event?.nativeEvent?.metaKey);
}

export function stopWikiLinkActivation(event?: WikiLinkActivationEvent): void {
	event?.preventDefault?.();
	event?.stopPropagation?.();
}
