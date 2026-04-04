import { PAGE_SIZE } from "@/constants/pagination";
import { NoteService } from "@/services/notes/noteService";
import {
	type NoteIndexItem,
	NotesIndexService,
} from "@/services/notes/notesIndex";
import type { NoteStatus } from "@/services/notes/types";
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

export function extractWikiLinkTitle(content: string): string | null {
	const match = /^\s*\[\[(.+?)\]\]\s*$/.exec(content);
	const title = match?.[1]?.trim();
	return title ? title : null;
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

export async function updateLinkedTodoNoteStatus(
	noteId: string,
	title: string,
	status: NoteStatus,
): Promise<void> {
	const trimmedId = noteId.trim();
	const trimmedTitle = title.trim();
	if (trimmedId.length === 0 || trimmedTitle.length === 0) {
		return;
	}

	const existing = await NoteService.loadNote(trimmedId);
	if (!existing) {
		return;
	}

	const now = Date.now();
	await NoteService.saveNote(
		{
			id: trimmedId,
			title: trimmedTitle,
			content: existing.content,
			isPinned: existing.isPinned,
			noteType: "todo",
			status,
			createdAt: existing.createdAt ?? now,
			completedAt: status === "done" ? (existing.completedAt ?? now) : null,
		},
		false,
	);
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

export function stopWikiLinkActivation(event?: WikiLinkActivationEvent): void {
	event?.preventDefault?.();
	event?.stopPropagation?.();
}
