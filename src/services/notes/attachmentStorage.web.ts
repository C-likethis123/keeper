import { getTauriInvoke } from "@/services/storage/runtime";
import { NOTES_ROOT } from "./Notes";

export type AttachmentType = "pdf" | "epub";

export function inferAttachmentType(path: string): AttachmentType | null {
	const lower = path.toLowerCase();
	if (lower.endsWith(".pdf")) return "pdf";
	if (lower.endsWith(".epub")) return "epub";
	return null;
}

function uniqueId(): string {
	return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function tauriConvertFileSrc(absolutePath: string): string {
	// Tauri 2.x asset protocol: asset://localhost/<url-encoded-path>
	// The entire path must be fully URL-encoded
	const encoded = encodeURIComponent(absolutePath);
	const isWindows = /windows/i.test(navigator.userAgent);
	return isWindows
		? `https://asset.localhost/${encoded}`
		: `asset://localhost/${encoded}`;
}

export async function copyPickedAttachmentToNote(
	uri: string,
	noteId: string,
): Promise<string> {
	// Tauri desktop: use the Tauri command API
	const invoke = getTauriInvoke();
	if (!invoke) throw new Error("Tauri invoke unavailable");
	const ext = uri.includes(".") ? `.${uri.split(".").pop()?.toLowerCase()}` : "";
	const filename = `${noteId}_${uniqueId()}${ext}`;
	const relativePath = await invoke<string>("copy_attachment", {
		sourcePath: uri,
		noteId,
		filename,
	});
	return relativePath;
}

export function resolveAttachmentUri(relativePath: string): string {
	// NOTES_ROOT on Tauri is the real filesystem path (e.g. /Users/.../notes)
	const base = NOTES_ROOT.endsWith("/") ? NOTES_ROOT.slice(0, -1) : NOTES_ROOT;
	return tauriConvertFileSrc(`${base}/${relativePath}`);
}

export async function deleteAttachment(relativePath: string): Promise<void> {
	// Tauri desktop: use the Tauri command API
	const invoke = getTauriInvoke();
	if (!invoke) return;
	await invoke("delete_attachment", { relativePath });
}
