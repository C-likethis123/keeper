import { NoteService } from "@/services/notes/noteService";
import { TemplateService } from "@/services/notes/templateService";
import type { Note, NoteTemplate, NoteType } from "@/services/notes/types";

type PersistEditorEntryInput = {
	id: string;
	title: string;
	content: string;
	isPinned: boolean;
	lastUpdated: number;
	noteType: NoteType;
	status?: Note["status"];
	previousNoteType?: NoteType;
	isNewEntry?: boolean;
};

function buildTemplatePayload(input: PersistEditorEntryInput): NoteTemplate {
	return {
		id: input.id,
		title: input.title,
		content: input.content,
		lastUpdated: input.lastUpdated,
		noteType: "template",
		status: undefined,
	};
}

function buildNotePayload(input: PersistEditorEntryInput): Note {
	return {
		id: input.id,
		title: input.title,
		content: input.content,
		isPinned: input.isPinned,
		lastUpdated: input.lastUpdated,
		noteType: input.noteType === "template" ? "note" : input.noteType,
		status:
			input.noteType === "todo"
				? (input.status ?? "open")
				: undefined,
	};
}

export async function persistEditorEntry(
	input: PersistEditorEntryInput,
): Promise<void> {
	const previousType = input.previousNoteType;
	if (input.noteType === "template") {
		await TemplateService.saveTemplate(
			buildTemplatePayload(input),
			input.isNewEntry || previousType !== "template",
		);
		if (previousType !== "template") {
			await NoteService.deleteNote(input.id);
		}
		return;
	}

	await NoteService.saveNote(
		buildNotePayload(input),
		input.isNewEntry || previousType === "template",
	);
	if (previousType === "template") {
		await TemplateService.deleteTemplate(input.id);
	}
}
