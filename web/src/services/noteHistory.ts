import {
	captureNoteVersion,
	deleteNoteVersions,
	getNoteVersion,
	listNoteVersions,
} from "@keeper/services/notes/noteHistoryService";
import type { BrowserNote } from "@web/ui/noteRepository";
import type { NoteHistoryVersion } from "@keeper/features/editor/note-history-contract";

function toBrowserVersion(
	version: Awaited<ReturnType<typeof listNoteVersions>>[number],
): NoteHistoryVersion<BrowserNote> {
	return { ...version, note: version.note as BrowserNote };
}

export async function listBrowserNoteVersions(noteId: string): Promise<NoteHistoryVersion<BrowserNote>[]> {
	return (await listNoteVersions(noteId)).map(toBrowserVersion);
}

/** Capture previous persisted state before overwrite. Mirrors NoteService.saveNote. */
export async function captureBrowserNoteVersion(note: BrowserNote): Promise<void> {
	await captureNoteVersion(note);
}

export async function getBrowserNoteVersion(noteId: string, versionId: string): Promise<NoteHistoryVersion<BrowserNote> | null> {
	const version = await getNoteVersion(noteId, versionId);
	return version ? toBrowserVersion(version) : null;
}

export async function deleteBrowserNoteVersions(noteId: string): Promise<void> {
	await deleteNoteVersions(noteId);
}
