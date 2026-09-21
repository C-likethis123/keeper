import { browserStorage } from "@web/services/storage";
import { toCanonicalBrowserNote, type BrowserNote } from "@web/ui/noteRepository";
import type { NoteHistoryVersion } from "@keeper/features/editor/note-history-contract";

const VERSION_LIMIT = 100;
const keyFor = (version: 1 | 2, noteId: string) => `note-history:v${version}:${noteId}`;

function isVersion(value: unknown): value is NoteHistoryVersion<BrowserNote> {
	if (!value || typeof value !== "object") return false;
	const version = value as Partial<NoteHistoryVersion<BrowserNote>>;
	return typeof version.id === "string" && typeof version.capturedAt === "number" && !!version.note && typeof version.note.id === "string" && typeof version.note.content === "string" && typeof version.note.lastUpdated === "number";
}

type LegacyVersion = { id: string; capturedAt: number; note: { id: string; title: string; content: string; noteType: "note" | "document" | "video" | "drawing"; isPinned: boolean; updatedAt: number } };
function isLegacyVersion(value: unknown): value is LegacyVersion {
	if (!value || typeof value !== "object") return false;
	const version = value as Partial<LegacyVersion>;
	return typeof version.id === "string" && typeof version.capturedAt === "number" && !!version.note && typeof version.note === "object" && typeof version.note.id === "string" && typeof version.note.title === "string" && typeof version.note.content === "string" && typeof version.note.updatedAt === "number" && typeof version.note.isPinned === "boolean" && ["note", "document", "video", "drawing"].includes(version.note.noteType ?? "");
}

export async function listBrowserNoteVersions(noteId: string): Promise<NoteHistoryVersion<BrowserNote>[]> {
	const serialized = await browserStorage.getState(keyFor(2, noteId));
	if (serialized) try { const parsed: unknown = JSON.parse(serialized); if (Array.isArray(parsed) && parsed.every(isVersion)) return parsed.filter((version) => version.note.id === noteId).sort((a, b) => b.capturedAt - a.capturedAt); } catch { /* use retained v1 history */ }
	const legacy = await browserStorage.getState(keyFor(1, noteId));
	if (!legacy) return [];
	try {
		const parsed: unknown = JSON.parse(legacy);
		if (!Array.isArray(parsed) || !parsed.every(isLegacyVersion)) return [];
		const migrated = parsed.map((version) => ({ ...version, note: toCanonicalBrowserNote(version.note) }));
		await browserStorage.setState(keyFor(2, noteId), JSON.stringify(migrated));
		return migrated.filter((version) => version.note.id === noteId).sort((a, b) => b.capturedAt - a.capturedAt);
	} catch { return []; }
}

/** Capture previous persisted state before overwrite. Mirrors NoteService.saveNote. */
export async function captureBrowserNoteVersion(note: BrowserNote): Promise<void> {
	const versions = await listBrowserNoteVersions(note.id);
	const version: NoteHistoryVersion<BrowserNote> = { id: `${Date.now()}-${crypto.randomUUID()}`, capturedAt: Date.now(), note: structuredClone(note) };
	await browserStorage.setState(keyFor(2, note.id), JSON.stringify([version, ...versions].slice(0, VERSION_LIMIT)));
}

export async function getBrowserNoteVersion(noteId: string, versionId: string): Promise<NoteHistoryVersion<BrowserNote> | null> {
	return (await listBrowserNoteVersions(noteId)).find((version) => version.id === versionId) ?? null;
}

export async function deleteBrowserNoteVersions(noteId: string): Promise<void> {
	await browserStorage.setState(keyFor(2, noteId), "[]");
}
