import { browserStorage } from "@/services/storage";
import type { BrowserNote } from "@/ui/noteRepository";
import type { NoteHistoryVersion } from "@keeper/features/editor/note-history-contract";

const VERSION_LIMIT = 100;
const keyFor = (noteId: string) => `note-history:v1:${noteId}`;

function isVersion(value: unknown): value is NoteHistoryVersion<BrowserNote> {
	if (!value || typeof value !== "object") return false;
	const version = value as Partial<NoteHistoryVersion<BrowserNote>>;
	return typeof version.id === "string" && typeof version.capturedAt === "number" && !!version.note && typeof version.note.id === "string" && typeof version.note.content === "string";
}

export async function listBrowserNoteVersions(noteId: string): Promise<NoteHistoryVersion<BrowserNote>[]> {
	const serialized = await browserStorage.getState(keyFor(noteId));
	if (!serialized) return [];
	try {
		const parsed: unknown = JSON.parse(serialized);
		return Array.isArray(parsed) ? parsed.filter(isVersion).filter((version) => version.note.id === noteId).sort((a, b) => b.capturedAt - a.capturedAt) : [];
	} catch { return []; }
}

/** Capture previous persisted state before overwrite. Mirrors NoteService.saveNote. */
export async function captureBrowserNoteVersion(note: BrowserNote): Promise<void> {
	const versions = await listBrowserNoteVersions(note.id);
	const version: NoteHistoryVersion<BrowserNote> = { id: `${Date.now()}-${crypto.randomUUID()}`, capturedAt: Date.now(), note: structuredClone(note) };
	await browserStorage.setState(keyFor(note.id), JSON.stringify([version, ...versions].slice(0, VERSION_LIMIT)));
}

export async function getBrowserNoteVersion(noteId: string, versionId: string): Promise<NoteHistoryVersion<BrowserNote> | null> {
	return (await listBrowserNoteVersions(noteId)).find((version) => version.id === versionId) ?? null;
}

export async function deleteBrowserNoteVersions(noteId: string): Promise<void> {
	await browserStorage.setState(keyFor(noteId), "[]");
}
