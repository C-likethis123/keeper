import {
	deleteAttachment as deleteCanonicalAttachment,
	inferAttachmentType,
	releaseAttachmentUri as releaseCanonicalAttachmentUri,
	resolveAttachmentUri as resolveCanonicalAttachmentUri,
	saveAttachmentBytesToNotes as saveCanonicalAttachmentBytesToNotes,
	writeAttachmentBytesToNotes as writeCanonicalAttachmentBytesToNotes,
} from "@keeper/services/notes/attachmentStorage.web";
import { ensureCanonicalStorageInitialized } from "@web/services/canonicalStorage";

export type AttachmentType = "pdf" | "epub";
export { inferAttachmentType };

export async function saveAttachmentBytesToNotes(
	bytes: Uint8Array,
	originalName: string,
	noteId?: string,
): Promise<string> {
	await ensureCanonicalStorageInitialized();
	return saveCanonicalAttachmentBytesToNotes(bytes, originalName, noteId);
}

export async function resolveAttachmentUri(path: string): Promise<string> {
	await ensureCanonicalStorageInitialized();
	return resolveCanonicalAttachmentUri(path);
}

export async function writeAttachmentBytesToNotes(
	path: string,
	bytes: Uint8Array,
): Promise<void> {
	await ensureCanonicalStorageInitialized();
	await writeCanonicalAttachmentBytesToNotes(path, bytes);
}

export async function deleteAttachment(path: string): Promise<void> {
	await ensureCanonicalStorageInitialized();
	await deleteCanonicalAttachment(path);
}

export function releaseAttachmentUri(path: string): void {
	releaseCanonicalAttachmentUri(path);
}
