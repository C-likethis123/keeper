import { storageEngine } from "@/services/storage/storageEngine";

export type AttachmentType = "pdf" | "epub";

const objectUrls = new Map<string, string>();

export function inferAttachmentType(path: string): AttachmentType | null {
	const lower = path.toLowerCase();
	if (lower.endsWith(".pdf")) return "pdf";
	if (lower.endsWith(".epub")) return "epub";
	return null;
}

function uniqueId(): string {
	return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function getExtension(path: string): string {
	const match = path.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
	return match ? `.${match[1].toLowerCase()}` : "";
}

function attachmentMimeType(type: AttachmentType): string {
	return type === "pdf" ? "application/pdf" : "application/epub+zip";
}

function blobBytes(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	) as ArrayBuffer;
}

function cacheObjectUrl(
	relativePath: string,
	bytes: Uint8Array,
	type: AttachmentType,
): string {
	const oldUrl = objectUrls.get(relativePath);
	if (oldUrl) URL.revokeObjectURL(oldUrl);
	const url = URL.createObjectURL(
		new Blob([blobBytes(bytes)], { type: attachmentMimeType(type) }),
	);
	objectUrls.set(relativePath, url);
	return url;
}



export async function saveAttachmentBytesToNotes(
	bytes: Uint8Array,
	originalName: string,
	noteId = "attachment",
): Promise<string> {
	const type = inferAttachmentType(originalName);
	if (!type) throw new Error("Unsupported attachment type");
	const relativePath = `_attachments/${noteId}_${uniqueId()}${getExtension(originalName)}`;
	await writeAttachmentBytesToNotes(relativePath, bytes);
	cacheObjectUrl(relativePath, bytes, type);
	return relativePath;
}

export async function writeAttachmentBytesToNotes(
	relativePath: string,
	bytes: Uint8Array,
): Promise<void> {
	if (!inferAttachmentType(relativePath)) {
		throw new Error(`Unsupported attachment type: ${relativePath}`);
	}
	await storageEngine.writeFileBytes(relativePath, bytes);
	const objectUrl = objectUrls.get(relativePath);
	if (objectUrl) URL.revokeObjectURL(objectUrl);
	objectUrls.delete(relativePath);
}

export async function resolveAttachmentUri(relativePath: string): Promise<string> {
	const cachedUrl = objectUrls.get(relativePath);
	if (cachedUrl) return cachedUrl;
	const bytes = await storageEngine.readFileBytes(relativePath);
	if (!bytes) throw new Error(`Attachment not found: ${relativePath}`);
	const type = inferAttachmentType(relativePath);
	if (!type) throw new Error(`Unsupported attachment type: ${relativePath}`);
	return cacheObjectUrl(relativePath, bytes, type);
}

export async function deleteAttachment(relativePath: string): Promise<void> {
	await storageEngine.deleteFile(relativePath);
	const objectUrl = objectUrls.get(relativePath);
	if (objectUrl) URL.revokeObjectURL(objectUrl);
	objectUrls.delete(relativePath);
}

export function releaseAttachmentUri(relativePath: string): void {
	const objectUrl = objectUrls.get(relativePath);
	if (objectUrl) URL.revokeObjectURL(objectUrl);
	objectUrls.delete(relativePath);
}
