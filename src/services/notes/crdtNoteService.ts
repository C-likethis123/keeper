import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Y from "yjs";
import { storageEngine } from "@/services/storage/storageEngine";
import type { NoteSaveInput } from "./types";

const CRDT_ROOT = ".keeper-crdt/notes";
const CLIENT_ID_KEY = "keeper:crdt:client-id";
const BODY_KEY = "body";
const FRONTMATTER_KEY = "frontmatter";
const LOCAL_SAVE_ORIGIN = "keeper-local-save";
const COMPACTED_CLIENT_ID = "compacted";

function encodeNoteId(noteId: string): string {
	return encodeURIComponent(noteId);
}

function decodeNoteId(encoded: string): string {
	return decodeURIComponent(encoded);
}

function updatesDir(noteId: string, clientId?: string): string {
	const base = `${CRDT_ROOT}/${encodeNoteId(noteId)}/updates`;
	return clientId ? `${base}/${clientId}` : base;
}

function hashBytes(bytes: Uint8Array): string {
	let hash = 2166136261;
	for (const byte of bytes) {
		hash ^= byte;
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

function createClientId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getClientId(): Promise<string> {
	const existing = await AsyncStorage.getItem(CLIENT_ID_KEY);
	if (existing) {
		return existing;
	}

	const next = createClientId();
	await AsyncStorage.setItem(CLIENT_ID_KEY, next);
	return next;
}

async function listUpdatePaths(noteId: string): Promise<string[]> {
	return storageEngine
		.listFilesRecursive(updatesDir(noteId))
		.then((paths) => paths.filter((path) => path.endsWith(".bin")).sort());
}

async function getNextSequence(noteId: string, clientId: string): Promise<number> {
	const prefix = `${updatesDir(noteId, clientId)}/`;
	const paths = await listUpdatePaths(noteId);
	let maxSequence = 0;
	for (const path of paths) {
		if (!path.startsWith(prefix)) {
			continue;
		}
		const fileName = path.slice(prefix.length);
		const sequence = Number.parseInt(fileName.split("-")[0] ?? "", 10);
		if (Number.isFinite(sequence)) {
			maxSequence = Math.max(maxSequence, sequence);
		}
	}
	return maxSequence + 1;
}

async function persistUpdate(noteId: string, update: Uint8Array): Promise<void> {
	if (update.length === 0) {
		return;
	}

	const clientId = await getClientId();
	const sequence = await getNextSequence(noteId, clientId);
	const fileName = `${String(sequence).padStart(8, "0")}-${hashBytes(update)}.bin`;
	await storageEngine.writeFileBytes(
		`${updatesDir(noteId, clientId)}/${fileName}`,
		update,
	);
}

export async function persistCrdtUpdate(
	noteId: string,
	update: Uint8Array | number[],
): Promise<void> {
	await persistUpdate(noteId, Uint8Array.from(update));
}

export async function compactCrdtUpdates(noteId: string): Promise<boolean> {
	const updatePaths = await listUpdatePaths(noteId);
	if (updatePaths.length <= 1) {
		return false;
	}

	const updates: Uint8Array[] = [];
	for (const path of updatePaths) {
		const update = await storageEngine.readFileBytes(path);
		if (update) {
			updates.push(update);
		}
	}
	if (updates.length <= 1) {
		return false;
	}

	const mergedUpdate = Y.mergeUpdates(updates);
	await storageEngine.deleteDirectory(updatesDir(noteId));
	const fileName = `00000001-${hashBytes(mergedUpdate)}.bin`;
	await storageEngine.writeFileBytes(
		`${updatesDir(noteId, COMPACTED_CLIENT_ID)}/${fileName}`,
		mergedUpdate,
	);
	return true;
}

function applyMarkdownPatch(text: Y.Text, nextMarkdown: string): void {
	const currentMarkdown = text.toString();
	if (currentMarkdown === nextMarkdown) {
		return;
	}

	let prefixLength = 0;
	const maxPrefix = Math.min(currentMarkdown.length, nextMarkdown.length);
	while (
		prefixLength < maxPrefix &&
		currentMarkdown[prefixLength] === nextMarkdown[prefixLength]
	) {
		prefixLength += 1;
	}

	let suffixLength = 0;
	const maxSuffix = Math.min(
		currentMarkdown.length - prefixLength,
		nextMarkdown.length - prefixLength,
	);
	while (
		suffixLength < maxSuffix &&
		currentMarkdown[currentMarkdown.length - 1 - suffixLength] ===
			nextMarkdown[nextMarkdown.length - 1 - suffixLength]
	) {
		suffixLength += 1;
	}

	const deleteLength = currentMarkdown.length - prefixLength - suffixLength;
	if (deleteLength > 0) {
		text.delete(prefixLength, deleteLength);
	}

	const insertText = nextMarkdown.slice(
		prefixLength,
		nextMarkdown.length - suffixLength,
	);
	if (insertText.length > 0) {
		text.insert(prefixLength, insertText);
	}
}

function metadataValue(value: unknown): unknown {
	return value === undefined ? null : value;
}

function setMapValueIfChanged(
	map: Y.Map<unknown>,
	key: string,
	value: unknown,
): void {
	const nextValue = metadataValue(value);
	if (JSON.stringify(map.get(key) ?? null) === JSON.stringify(nextValue)) {
		return;
	}
	map.set(key, nextValue);
}

function writeFrontmatterMetadata(doc: Y.Doc, note: NoteSaveInput): void {
	const frontmatter = doc.getMap(FRONTMATTER_KEY);
	setMapValueIfChanged(frontmatter, "title", note.title);
	setMapValueIfChanged(frontmatter, "isPinned", !!note.isPinned);
	setMapValueIfChanged(frontmatter, "noteType", note.noteType);
	setMapValueIfChanged(frontmatter, "status", note.status ?? null);
	setMapValueIfChanged(frontmatter, "createdAt", note.createdAt ?? null);
	setMapValueIfChanged(frontmatter, "completedAt", note.completedAt ?? null);
	setMapValueIfChanged(frontmatter, "attachment", note.attachment ?? null);
	setMapValueIfChanged(frontmatter, "attachedVideo", note.attachedVideo ?? null);
	setMapValueIfChanged(frontmatter, "resourceUrl", note.resourceUrl ?? null);
	setMapValueIfChanged(
		frontmatter,
		"documentPositions",
		note.documentPositions ?? null,
	);
}

export async function hasCrdtNote(noteId: string): Promise<boolean> {
	return (await listUpdatePaths(noteId)).length > 0;
}

export async function loadCrdtDoc(
	noteId: string,
	bootstrapMarkdown?: string,
): Promise<Y.Doc> {
	const doc = new Y.Doc();
	const updatePaths = await listUpdatePaths(noteId);

	for (const path of updatePaths) {
		const update = await storageEngine.readFileBytes(path);
		if (update) {
			Y.applyUpdate(doc, update);
		}
	}

	if (updatePaths.length === 0 && bootstrapMarkdown !== undefined) {
		doc.getText(BODY_KEY).insert(0, bootstrapMarkdown);
		await persistUpdate(noteId, Y.encodeStateAsUpdate(doc));
	}

	return doc;
}

export interface CrdtEditorSnapshot {
	update: number[];
	markdown: string;
}

export async function loadCrdtEditorSnapshot(
	noteId: string,
): Promise<CrdtEditorSnapshot | null> {
	if (!(await hasCrdtNote(noteId))) {
		return null;
	}

	const doc = await loadCrdtDoc(noteId);
	return {
		update: [...Y.encodeStateAsUpdate(doc)],
		markdown: doc.getText(BODY_KEY).toString(),
	};
}

export async function saveMarkdownToCrdt(
	note: NoteSaveInput,
): Promise<NoteSaveInput> {
	const doc = await loadCrdtDoc(note.id);
	let localUpdate: Uint8Array | null = null;
	const captureUpdate = (update: Uint8Array, origin: unknown) => {
		if (origin === LOCAL_SAVE_ORIGIN) {
			localUpdate = update;
		}
	};

	doc.on("update", captureUpdate);
	doc.transact(() => {
		applyMarkdownPatch(doc.getText(BODY_KEY), note.content);
		writeFrontmatterMetadata(doc, note);
	}, LOCAL_SAVE_ORIGIN);
	doc.off("update", captureUpdate);

	if (localUpdate) {
		await persistUpdate(note.id, localUpdate);
	}

	return {
		...note,
		content: doc.getText(BODY_KEY).toString(),
	};
}

export async function readCrdtMarkdown(
	noteId: string,
): Promise<string | null> {
	if (!(await hasCrdtNote(noteId))) {
		return null;
	}
	const doc = await loadCrdtDoc(noteId);
	return doc.getText(BODY_KEY).toString();
}

export async function readCrdtFrontmatter(
	noteId: string,
): Promise<Record<string, unknown> | null> {
	if (!(await hasCrdtNote(noteId))) {
		return null;
	}
	const doc = await loadCrdtDoc(noteId);
	return Object.fromEntries(doc.getMap(FRONTMATTER_KEY).entries());
}

export async function listCrdtNoteIds(): Promise<string[]> {
	const paths = await storageEngine.listFilesRecursive(CRDT_ROOT);
	const noteIds = new Set<string>();
	for (const path of paths) {
		const parts = path.split("/");
		const notesIndex = parts.indexOf("notes");
		const encodedNoteId = notesIndex >= 0 ? parts[notesIndex + 1] : undefined;
		if (encodedNoteId) {
			noteIds.add(decodeNoteId(encodedNoteId));
		}
	}
	return [...noteIds].sort();
}

export async function deleteCrdtNote(noteId: string): Promise<void> {
	await storageEngine.deleteDirectory(`${CRDT_ROOT}/${encodeNoteId(noteId)}`);
}
