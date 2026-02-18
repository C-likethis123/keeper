import { Directory, File } from "expo-file-system";
import { NOTES_ROOT } from "./Notes";
import { NotesMetaService } from "./notesMetaService";
import { toAbsoluteNotesPath } from "./notesPaths";

export interface NoteIndexItem {
	noteId: string;
	summary: string;
	title?: string;
	isPinned: boolean;
	sortTimestamp: number;
	createdAt: number;
	updatedAt: number;
}

export interface ListNotesResult {
	items: NoteIndexItem[];
	cursor?: Record<string, unknown>;
}

async function collectMdRelativePaths(
	dirPath: string,
	baseRelative: string,
): Promise<string[]> {
	const paths: string[] = [];
	try {
		const dir = new Directory(dirPath);
		if (!dir.exists) return paths;
		const entries = dir.list();
		const prefix = dirPath.endsWith("/") ? dirPath : dirPath + "/";
		for (const entry of entries) {
			const name = entry.name;
			if (name === ".git") continue;
			const rel = baseRelative ? baseRelative + "/" + name : name;
			if (entry instanceof File && name.endsWith(".md")) {
				paths.push(rel);
			}
			if (entry instanceof Directory) {
				paths.push(...(await collectMdRelativePaths(prefix + name, rel)));
			}
		}
	} catch (e) {
		console.warn("Failed to list directory for notes index:", dirPath, e);
	}
	return paths;
}

async function loadNoteItem(
	relativePath: string,
	pinned: boolean,
): Promise<NoteIndexItem | null> {
	const fullPath = toAbsoluteNotesPath(relativePath);
	const file = new File(fullPath);
	if (!file.exists) return null;
	const content = await file.text();
	const mtime = file.modificationTime!;
	const title = decodeURIComponent(
		relativePath.split("/").pop()?.replace(/\.md$/, "") ?? "Untitled",
	);
	return {
		noteId: relativePath,
		summary: extractSummary(content),
		title,
		isPinned: pinned,
		sortTimestamp: mtime,
		createdAt: mtime,
		updatedAt: mtime,
	};
}

export class NotesIndexService {
	static instance = new NotesIndexService();

	private constructor() {}

	async getNote(noteId: string): Promise<NoteIndexItem | null> {
		const pinned = await NotesMetaService.getPinned(noteId);
		return loadNoteItem(noteId, pinned);
	}

	static async upsertNote(item: NoteIndexItem): Promise<void> {
		await NotesMetaService.setPinned(item.noteId, item.isPinned);
	}

	static async deleteNote(noteId: string): Promise<void> {
		await NotesMetaService.removePin(noteId);
	}

	static async listAllNotes(
		limit = 20,
		cursor?: Record<string, unknown>,
		query?: string,
	): Promise<ListNotesResult> {
		const root = NOTES_ROOT.endsWith("/")
			? NOTES_ROOT.slice(0, -1)
			: NOTES_ROOT;
		const pinned = await NotesMetaService.getPinnedMap();
		const relativePaths = await collectMdRelativePaths(root, "");
		const items: NoteIndexItem[] = [];
		for (const relativePath of relativePaths) {
			const item = await loadNoteItem(
				relativePath,
				pinned[relativePath] ?? false,
			);
			if (item) items.push(item);
		}
		items.sort((a, b) => {
			if (a.isPinned && !b.isPinned) return -1;
			if (!a.isPinned && b.isPinned) return 1;
			return b.updatedAt - a.updatedAt;
		});
		let filtered = items;
		if (query && query.trim().length > 0) {
			const q = query.trim();
			filtered = items.filter((item) =>
				(item.title ?? "").toLowerCase().includes(q.toLowerCase()),
			);
		}
		const offset = (cursor?.offset as number) ?? 0;
		const page = filtered.slice(offset, offset + limit);
		const nextCursor =
			offset + limit < filtered.length ? { offset: offset + limit } : undefined;
		return { items: page, cursor: nextCursor };
	}
}

export function extractSummary(markdown: string, maxLines = 6): string {
	const lines = markdown.split(/\r?\n/);
	const nonEmptyLines: string[] = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		nonEmptyLines.push(trimmed);
		if (nonEmptyLines.length >= maxLines) break;
	}
	return nonEmptyLines.join("\n");
}
