import { Directory, File } from "expo-file-system";
import { NOTES_ROOT } from "./Notes";

export type AttachmentType = "pdf" | "epub";

function getExtension(uri: string): string {
	const match = uri.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
	return match ? `.${match[1].toLowerCase()}` : "";
}

export function inferAttachmentType(path: string): AttachmentType | null {
	const lower = path.toLowerCase();
	if (lower.endsWith(".pdf")) return "pdf";
	if (lower.endsWith(".epub")) return "epub";
	return null;
}

function uniqueId(): string {
	return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function copyPickedAttachmentToNote(
	uri: string,
	noteId: string,
): Promise<string> {
	const ext = getExtension(uri);
	const filename = `${noteId}_${uniqueId()}${ext}`;
	const attachmentsDir = new Directory(NOTES_ROOT, "_attachments");
	if (!attachmentsDir.exists) {
		attachmentsDir.create({ intermediates: true });
	}
	const source = new File(uri);
	const dest = new File(attachmentsDir, filename);
	source.copy(dest);
	return `_attachments/${filename}`;
}

export function resolveAttachmentUri(relativePath: string): string {
	// NOTES_ROOT ends with '/' on iOS, join carefully
	const base = NOTES_ROOT.endsWith("/") ? NOTES_ROOT : `${NOTES_ROOT}/`;
	return `${base}${relativePath}`;
}

export async function deleteAttachment(relativePath: string): Promise<void> {
	const file = new File(NOTES_ROOT, relativePath);
	if (file.exists) {
		file.delete();
	}
}
