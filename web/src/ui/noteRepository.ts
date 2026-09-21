import { browserStorage } from "@web/services/storage";
import type { CanonicalNote } from "@keeper/features/notes/note-contract";

export type BrowserNote = CanonicalNote;
export type BrowserNoteSurface = "note" | "document" | "video" | "drawing";

type LegacyBrowserNote = {
	id: string;
	title: string;
	content: string;
	noteType: BrowserNoteSurface;
	isPinned: boolean;
	updatedAt: number;
};

const NOTES_V1_KEY = "notes:v1";
const NOTES_V2_KEY = "notes:v2";

function isLegacyBrowserNote(value: unknown): value is LegacyBrowserNote {
	if (!value || typeof value !== "object") return false;
	const note = value as Partial<LegacyBrowserNote>;
	return typeof note.id === "string" && typeof note.title === "string" && typeof note.content === "string" && (note.noteType === "note" || note.noteType === "document" || note.noteType === "video" || note.noteType === "drawing") && typeof note.isPinned === "boolean" && typeof note.updatedAt === "number";
}

function isBrowserNote(value: unknown): value is BrowserNote {
	if (!value || typeof value !== "object") return false;
	const note = value as Partial<BrowserNote>;
	return typeof note.id === "string" && typeof note.title === "string" && typeof note.content === "string" && typeof note.lastUpdated === "number" && typeof note.isPinned === "boolean" && ["journal", "resource", "todo", "note", "template", "drawing"].includes(note.noteType ?? "");
}

export function toCanonicalBrowserNote(note: LegacyBrowserNote): BrowserNote {
	const isDocument = note.noteType === "document";
	const isVideo = note.noteType === "video";
	return {
		id: note.id, title: note.title, content: isDocument || isVideo ? "" : note.content,
		lastUpdated: note.updatedAt, modified: note.updatedAt, isPinned: note.isPinned,
		noteType: note.noteType === "drawing" ? "drawing" : "note", status: null,
		createdAt: null, completedAt: null, attachment: isDocument ? note.content : null,
		attachedVideo: isVideo ? note.content : null, resourceUrl: null, documentPositions: null,
	};
}

export function getBrowserNoteSurface(note: BrowserNote): BrowserNoteSurface {
	if (note.noteType === "drawing") return "drawing";
	if (note.attachment) return "document";
	if (note.attachedVideo) return "video";
	return "note";
}

export async function loadBrowserNotes(): Promise<BrowserNote[]> {
	const v2 = await browserStorage.getState(NOTES_V2_KEY);
	if (v2) {
		try { const parsed: unknown = JSON.parse(v2); if (Array.isArray(parsed) && parsed.every(isBrowserNote)) return parsed; } catch { /* use retained v1 data */ }
	}
	const v1 = await browserStorage.getState(NOTES_V1_KEY);
	if (!v1) return [];
	try {
		const parsed: unknown = JSON.parse(v1);
		if (!Array.isArray(parsed) || !parsed.every(isLegacyBrowserNote)) return [];
		const migrated = parsed.map(toCanonicalBrowserNote);
		await browserStorage.setState(NOTES_V2_KEY, JSON.stringify(migrated));
		return migrated;
	} catch { return []; }
}

export async function persistBrowserNotes(notes: BrowserNote[]): Promise<void> {
	await browserStorage.setState(NOTES_V2_KEY, JSON.stringify(notes));
}
