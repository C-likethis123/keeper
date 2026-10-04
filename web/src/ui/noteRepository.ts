import type { Note } from "@/services/notes/types";
import { extractSummary } from "@/services/notes/noteSummary";
import { storageEngine } from "@/services/storage/storageEngine";
import type { CanonicalNote } from "@keeper/features/notes/note-contract";
import { ensureCanonicalStorageInitialized } from "@web/services/canonicalStorage";

export type BrowserNote = CanonicalNote;
export type BrowserNoteSurface = "note" | "document" | "video" | "drawing";

export const BROWSER_NOTES_CHANGED = "keeper:browser-notes-changed";

function toBrowserNote(note: Note): BrowserNote {
	return {
		id: note.id,
		title: note.title,
		content: note.content,
		lastUpdated: note.lastUpdated,
		isPinned: note.isPinned,
		noteType: note.noteType,
		status: note.status ?? null,
		createdAt: note.createdAt ?? null,
		completedAt: note.completedAt ?? null,
		attachment: note.attachment ?? null,
		attachedVideo: note.attachedVideo ?? null,
		resourceUrl: note.resourceUrl ?? null,
		documentPositions: note.documentPositions ?? null,
		modified: note.modified ?? note.lastUpdated,
	};
}

function samePersistedNote(left: BrowserNote, right: BrowserNote): boolean {
	const rightStatus = right.noteType === "todo" ? right.status : null;
	const rightCreatedAt = right.noteType === "todo" ? right.createdAt : null;
	const rightCompletedAt = right.noteType === "todo" ? right.completedAt : null;
	return (
		left.title === right.title.trim() &&
		left.content === right.content &&
		left.isPinned === right.isPinned &&
		left.noteType === right.noteType &&
		left.status === rightStatus &&
		left.createdAt === rightCreatedAt &&
		left.completedAt === rightCompletedAt &&
		left.attachment === right.attachment &&
		left.attachedVideo === right.attachedVideo &&
		left.resourceUrl === right.resourceUrl &&
		JSON.stringify(left.documentPositions) ===
			JSON.stringify(right.documentPositions)
	);
}

export async function upsertBrowserNote(note: BrowserNote): Promise<void> {
	await ensureCanonicalStorageInitialized();
	const { lastUpdated: _lastUpdated, ...input } = note;
	const saved = await storageEngine.saveNote(input);
	await storageEngine.indexUpsert({
		noteId: saved.id,
		title: saved.title,
		summary: saved.noteType === "drawing" ? "Drawing" : extractSummary(saved.content),
		isPinned: saved.isPinned,
		updatedAt: saved.lastUpdated,
		noteType: saved.noteType,
		status: saved.status ?? null,
	});
}

export async function deleteBrowserNote(noteId: string): Promise<void> {
	await ensureCanonicalStorageInitialized();
	await storageEngine.deleteNote(noteId);
	await storageEngine.indexDelete(noteId);
}

export function getBrowserNoteSurface(note: BrowserNote): BrowserNoteSurface {
	if (note.noteType === "drawing") return "drawing";
	if (note.attachment) return "document";
	if (note.attachedVideo) return "video";
	return "note";
}

export async function loadBrowserNotes(): Promise<BrowserNote[]> {
	await ensureCanonicalStorageInitialized();
	const entries = await storageEngine.listNoteFiles();
	const notes = await Promise.all(
		entries.map(({ id }) => storageEngine.loadNote(id)),
	);
	return notes
		.filter((note): note is Note => note !== null)
		.map(toBrowserNote)
		.sort((left, right) => right.lastUpdated - left.lastUpdated);
}

export async function persistBrowserNotes(notes: BrowserNote[]): Promise<void> {
	await ensureCanonicalStorageInitialized();
	const desired = new Map<string, BrowserNote>();
	for (const note of notes) {
		const current = desired.get(note.id);
		if (!current || note.lastUpdated >= current.lastUpdated) {
			desired.set(note.id, note);
		}
	}

	const entries = await storageEngine.listNoteFiles();
	const existingNotes = await Promise.all(
		entries.map(({ id }) => storageEngine.loadNote(id)),
	);
	const existing = new Map(
		existingNotes
			.filter((note): note is Note => note !== null)
			.map((note) => [note.id, toBrowserNote(note)]),
	);

	for (const note of desired.values()) {
		const current = existing.get(note.id);
		if (!current || !samePersistedNote(current, note)) {
			await upsertBrowserNote(note);
		}
	}
	for (const id of existing.keys()) {
		if (desired.has(id)) continue;
		await deleteBrowserNote(id);
	}
}

/** Creates a canonical plain note for source editor features such as wiki links. */
export async function createBrowserLinkedNote(
	title: string,
): Promise<BrowserNote | null> {
	const normalizedTitle = title.trim();
	if (!normalizedTitle) return null;
	const notes = await loadBrowserNotes();
	const existing = notes.find(
		(note) =>
			note.title.trim().toLocaleLowerCase() ===
			normalizedTitle.toLocaleLowerCase(),
	);
	if (existing) return existing;
	const now = Date.now();
	const note: BrowserNote = {
		id: crypto.randomUUID(),
		title: normalizedTitle,
		content: "",
		noteType: "note",
		isPinned: false,
		lastUpdated: now,
		modified: now,
		status: null,
		createdAt: now,
		completedAt: null,
		attachment: null,
		attachedVideo: null,
		resourceUrl: null,
		documentPositions: null,
	};
	const updated = [note, ...notes];
	await persistBrowserNotes(updated);
	if (typeof window !== "undefined")
		window.dispatchEvent(
			new CustomEvent<BrowserNote[]>(BROWSER_NOTES_CHANGED, {
				detail: updated,
			}),
		);
	return note;
}
