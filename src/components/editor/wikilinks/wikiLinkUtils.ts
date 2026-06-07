import { PAGE_SIZE } from "@/constants/pagination";
import { NoteService } from "@/services/notes/noteService";
import {
	type NoteIndexItem,
	NotesIndexService,
} from "@/services/notes/notesIndex";
import { nanoid } from "nanoid";

interface WikiLinkActivationEvent {
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

export function buildTrackedTodoTitle(taskText: string): string {
	const trimmed = taskText.trim();
	return trimmed.length === 0 ? "TODO:" : `TODO: ${trimmed}`;
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

export async function resolveOrCreateTrackedTodoNoteId(
	taskText: string,
): Promise<string | null> {
	const title = buildTrackedTodoTitle(taskText);
	if (title.trim().length === 0) {
		return null;
	}

	const existingNoteId = await resolveWikiLinkNoteId(title);
	if (existingNoteId) {
		return existingNoteId;
	}

	const now = Date.now();
	const created = await NoteService.saveNote(
		{
			id: nanoid(),
			title,
			content: "",
			isPinned: false,
			noteType: "todo",
			status: "open",
			createdAt: now,
			completedAt: null,
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

	return Boolean(event?.nativeEvent?.metaKey || event?.nativeEvent?.ctrlKey);
}
