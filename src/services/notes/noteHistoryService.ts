import type { Note } from "@/services/notes/types";
import { storageEngine } from "@/services/storage/storageEngine";

const HISTORY_ROOT = ".keeper/history";
const HISTORY_FILE_SUFFIX = ".json";

export type NoteVersion = {
	id: string;
	capturedAt: number;
	note: Note;
};

type StoredNoteVersion = {
	formatVersion: 1;
	capturedAt: number;
	note: Note;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function historyDirectory(noteId: string): string {
	return `${HISTORY_ROOT}/${encodeURIComponent(noteId)}`;
}

function isStoredNoteVersion(value: unknown): value is StoredNoteVersion {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<StoredNoteVersion>;
	return (
		candidate.formatVersion === 1 &&
		typeof candidate.capturedAt === "number" &&
		!!candidate.note &&
		typeof candidate.note.id === "string" &&
		typeof candidate.note.content === "string"
	);
}

export async function captureNoteVersion(note: Note): Promise<void> {
	const capturedAt = Date.now();
	const stored: StoredNoteVersion = {
		formatVersion: 1,
		capturedAt,
		note,
	};
	const fileName = `${capturedAt}-${Math.random().toString(36).slice(2, 10)}${HISTORY_FILE_SUFFIX}`;
	await storageEngine.writeFileBytes(
		`${historyDirectory(note.id)}/${fileName}`,
		encoder.encode(JSON.stringify(stored)),
	);
}

export async function listNoteVersions(noteId: string): Promise<NoteVersion[]> {
	const directory = historyDirectory(noteId);
	const paths = await storageEngine.listFilesRecursive(directory);
	const versions = await Promise.all(
		paths
			.filter((path) => path.endsWith(HISTORY_FILE_SUFFIX))
			.map(async (path): Promise<NoteVersion | null> => {
				try {
					const bytes = await storageEngine.readFileBytes(path);
					if (!bytes) return null;
					const stored: unknown = JSON.parse(decoder.decode(bytes));
					if (!isStoredNoteVersion(stored) || stored.note.id !== noteId) {
						return null;
					}
					return { id: path, capturedAt: stored.capturedAt, note: stored.note };
				} catch {
					return null;
				}
			}),
	);

	return versions
		.filter((version): version is NoteVersion => version !== null)
		.sort((a, b) => b.capturedAt - a.capturedAt);
}

export async function getNoteVersion(
	noteId: string,
	versionId: string,
): Promise<NoteVersion | null> {
	if (!versionId.startsWith(`${historyDirectory(noteId)}/`)) return null;
	const bytes = await storageEngine.readFileBytes(versionId);
	if (!bytes) return null;
	try {
		const stored: unknown = JSON.parse(decoder.decode(bytes));
		if (!isStoredNoteVersion(stored) || stored.note.id !== noteId) return null;
		return { id: versionId, capturedAt: stored.capturedAt, note: stored.note };
	} catch {
		return null;
	}
}

export async function deleteNoteVersions(noteId: string): Promise<void> {
	await storageEngine.deleteDirectory(historyDirectory(noteId));
}
