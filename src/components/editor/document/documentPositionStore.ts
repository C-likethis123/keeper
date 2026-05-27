import { NoteService } from "@/services/notes/noteService";

export async function saveDocumentPosition(
	noteId: string,
	attachmentPath: string,
	position: string,
): Promise<void> {
	const note = await NoteService.loadNote(noteId);
	if (!note) return;

	const documentPositions = {
		...(note.documentPositions ?? {}),
		[attachmentPath]: position,
	};
	await NoteService.saveNote({
		...note,
		documentPositions,
	});
}

export async function loadDocumentPosition(
	noteId: string,
	attachmentPath: string,
): Promise<string | null> {
	const note = await NoteService.loadNote(noteId);
	return note?.documentPositions?.[attachmentPath] ?? null;
}

export async function clearDocumentPosition(
	noteId: string,
	attachmentPath: string,
): Promise<void> {
	const note = await NoteService.loadNote(noteId);
	if (!note?.documentPositions?.[attachmentPath]) return;

	const documentPositions = { ...note.documentPositions };
	delete documentPositions[attachmentPath];
	await NoteService.saveNote({
		...note,
		documentPositions:
			Object.keys(documentPositions).length > 0 ? documentPositions : null,
	});
}
