import {
	createDocumentFromMarkdown,
	documentToMarkdown,
} from "@/components/editor/core/Document";
import { NoteService } from "@/services/notes/noteService";
import type { Note, NoteSaveInput, NoteType } from "@/services/notes/types";

type PersistEditorEntryInput = {
	id: string;
	title: string;
	content: string;
	isPinned: boolean;
	noteType: NoteType;
	status?: Note["status"];
	previousNoteType?: NoteType;
	isNewEntry?: boolean;
};

function getPersistenceKey(id: string, noteType: NoteType): string {
	return noteType === "template" ? `template:${id}` : `note:${id}`;
}

function buildPayload(input: PersistEditorEntryInput): NoteSaveInput {
	const isTemplate = input.noteType === "template";
	return {
		id: input.id,
		title: input.title,
		content: input.content,
		isPinned: isTemplate ? false : input.isPinned,
		noteType: input.noteType,
		status: input.noteType === "todo" ? (input.status ?? "open") : null,
	};
}

function isSamePayload(a: NoteSaveInput, b: NoteSaveInput): boolean {
	return (
		a.id === b.id &&
		a.title.trim() === b.title.trim() &&
		normalizeMarkdownForPersistence(a.content) ===
			normalizeMarkdownForPersistence(b.content) &&
		!!a.isPinned === !!b.isPinned &&
		a.noteType === b.noteType &&
		(a.status ?? null) === (b.status ?? null)
	);
}

export function normalizeMarkdownForPersistence(markdown: string): string {
	return documentToMarkdown(createDocumentFromMarkdown(markdown));
}

export async function persistEditorEntry(
	input: PersistEditorEntryInput,
): Promise<void> {
	const previousType = input.previousNoteType;
	const isTypeTransition =
		previousType !== undefined && previousType !== input.noteType;
	const needsPathMove =
		!!previousType &&
		getPersistenceKey(input.id, previousType) !==
			getPersistenceKey(input.id, input.noteType);

	const payload = buildPayload(input);
	const existingNote = isTypeTransition
		? null
		: await NoteService.loadNote(input.id);

	if (!existingNote || !isSamePayload(existingNote, payload)) {
		await NoteService.saveNote(payload, input.isNewEntry || needsPathMove);
	}

	if (needsPathMove && previousType) {
		await NoteService.deleteNote(input.id, previousType);
	}
}
