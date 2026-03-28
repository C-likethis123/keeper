import {
	createDocumentFromMarkdown,
	documentToMarkdown,
} from "@/components/editor/core/Document";
import { NoteService } from "@/services/notes/noteService";
import { TemplateService } from "@/services/notes/templateService";
import type {
	Note,
	NoteSaveInput,
	NoteTemplateSaveInput,
	NoteType,
} from "@/services/notes/types";

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

function buildTemplatePayload(
	input: PersistEditorEntryInput,
): NoteTemplateSaveInput {
	return {
		id: input.id,
		title: input.title,
		content: input.content,
		noteType: "template",
		status: undefined,
	};
}

function buildNotePayload(input: PersistEditorEntryInput): NoteSaveInput {
	return {
		id: input.id,
		title: input.title,
		content: input.content,
		isPinned: input.isPinned,
		noteType: input.noteType === "template" ? "note" : input.noteType,
		status: input.noteType === "todo" ? (input.status ?? "open") : null,
	};
}

function isSameNotePayload(a: NoteSaveInput, b: NoteSaveInput): boolean {
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

function isSameTemplatePayload(
	a: NoteTemplateSaveInput,
	b: NoteTemplateSaveInput,
): boolean {
	return (
		a.id === b.id &&
		a.title.trim() === b.title.trim() &&
		normalizeMarkdownForPersistence(a.content) ===
			normalizeMarkdownForPersistence(b.content) &&
		a.noteType === b.noteType
	);
}

export function normalizeMarkdownForPersistence(markdown: string): string {
	return documentToMarkdown(createDocumentFromMarkdown(markdown));
}

export async function persistEditorEntry(
	input: PersistEditorEntryInput,
): Promise<void> {
	const previousType = input.previousNoteType;
	if (input.noteType === "template") {
		const payload = buildTemplatePayload(input);
		const isTypeTransition = previousType !== "template";
		const existingTemplate = isTypeTransition
			? null
			: await TemplateService.loadTemplate(input.id);
		if (
			!existingTemplate ||
			!isSameTemplatePayload(existingTemplate, payload)
		) {
			await TemplateService.saveTemplate(
				payload,
				input.isNewEntry || isTypeTransition,
			);
		}
		if (previousType !== "template") {
			await NoteService.deleteNote(input.id);
		}
		return;
	}

	const payload = buildNotePayload(input);
	const isTypeTransition = previousType === "template";
	const existingNote = isTypeTransition
		? null
		: await NoteService.loadNote(input.id);
	if (!existingNote || !isSameNotePayload(existingNote, payload)) {
		await NoteService.saveNote(payload, input.isNewEntry || isTypeTransition);
	}
	if (previousType === "template") {
		await TemplateService.deleteTemplate(input.id);
	}
}
