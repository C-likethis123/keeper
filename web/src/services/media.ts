import {
	deleteAttachment,
	releaseAttachmentUri,
	resolveAttachmentUri,
	saveAttachmentBytesToNotes,
} from "@web/adapters/browser/attachmentStorage";
import {
	releaseImageUri,
	resolveImageUri,
	saveImageBytesToNotes,
} from "@web/adapters/browser/imageStorage";

function blobBytes(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	) as ArrayBuffer;
}

export async function savePickedFile(
	file: File,
	folder: "assets" | "attachments",
): Promise<string> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	return folder === "assets"
		? saveImageBytesToNotes(bytes, file.type || "image/jpeg", file.name)
		: saveAttachmentBytesToNotes(bytes, file.name);
}
export async function saveBytes(
	bytes: Uint8Array,
	name: string,
	folder: "assets" | "attachments",
): Promise<string> {
	return folder === "assets"
		? saveImageBytesToNotes(bytes, "image/*", name)
		: saveAttachmentBytesToNotes(bytes, name);
}
export async function deleteStoredBrowserFile(path: string): Promise<void> {
	await deleteAttachment(path);
}
export function pickBrowserFile(accept: string): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.onchange = () => resolve(input.files?.[0] ?? null);
		input.oncancel = () => resolve(null);
		input.click();
	});
}
export async function resolveLocalFile(
	path: string,
	_type = "application/octet-stream",
): Promise<string> {
	return path.startsWith("assets/")
		? resolveImageUri(path)
		: resolveAttachmentUri(path);
}
export function releaseLocalFile(path: string): void {
	if (path.startsWith("assets/")) releaseImageUri(path);
	else releaseAttachmentUri(path);
}
export function readClipboardImage(event: ClipboardEvent): File | null {
	return (
		Array.from(event.clipboardData?.files ?? []).find((file) =>
			file.type.startsWith("image/"),
		) ?? null
	);
}
export async function writeClipboardText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
export function downloadBytes(
	bytes: Uint8Array,
	filename: string,
	type = "application/octet-stream",
): void {
	const url = URL.createObjectURL(new Blob([blobBytes(bytes)], { type }));
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	queueMicrotask(() => URL.revokeObjectURL(url));
}
