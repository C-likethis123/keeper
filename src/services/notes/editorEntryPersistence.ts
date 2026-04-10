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
	createdAt?: Note["createdAt"];
	completedAt?: Note["completedAt"];
	attachment?: Note["attachment"];
	isNewEntry?: boolean;
};

function buildPayload(
	input: PersistEditorEntryInput,
	existingNote: Note | null,
): NoteSaveInput {
	const nextStatus =
		input.noteType === "todo" ? (input.status ?? "open") : null;
	const now = Date.now();
	const createdAt =
		input.noteType === "todo"
			? (input.createdAt ?? existingNote?.createdAt ?? now)
			: null;
	const completedAt =
		input.noteType !== "todo"
			? null
			: input.completedAt !== undefined
				? input.completedAt
				: nextStatus === "done"
					? (existingNote?.completedAt ?? now)
					: null;

	return {
		id: input.id,
		title: input.title,
		content: input.content,
		isPinned: input.isPinned,
		noteType: input.noteType,
		status: nextStatus,
		createdAt,
		completedAt,
		attachment:
			input.attachment !== undefined
				? input.attachment
				: (existingNote?.attachment ?? null),
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
		(a.status ?? null) === (b.status ?? null) &&
		(a.createdAt ?? null) === (b.createdAt ?? null) &&
		(a.completedAt ?? null) === (b.completedAt ?? null) &&
		(a.attachment ?? null) === (b.attachment ?? null)
	);
}

export function normalizeMarkdownForPersistence(markdown: string): string {
	return documentToMarkdown(createDocumentFromMarkdown(markdown));
}

export async function persistEditorEntry(
	input: PersistEditorEntryInput,
): Promise<void> {
	const existingNote = await NoteService.loadNote(input.id);
	const payload = buildPayload(input, existingNote);

	if (!existingNote || !isSamePayload(existingNote, payload)) {
		await NoteService.saveNote(payload, input.isNewEntry ?? false);
	}
}
