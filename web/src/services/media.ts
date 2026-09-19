import { browserStorage } from "@/services/storage";
import { getDesktopBridge } from "@/services/platform";

const urls = new Map<string, string>();
function id(): string { return `${Date.now().toString(36)}-${crypto.randomUUID()}`; }
function extension(name: string, fallback: string): string { return /\.[a-z0-9]+$/i.exec(name)?.[0]?.toLowerCase() ?? fallback; }
function blobBytes(bytes: Uint8Array): ArrayBuffer { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; }

export async function savePickedFile(file: File, folder: "assets" | "attachments"): Promise<string> {
	const path = `${folder}/${id()}${extension(file.name, folder === "assets" ? ".jpg" : "")}`;
	await browserStorage.writeFile(path, new Uint8Array(await file.arrayBuffer()));
	return path;
}
/** Desktop pickers pass an absolute path; browser pickers pass a File above. */
export async function copyDesktopFile(sourcePath: string, noteId: string, kind: "image" | "attachment"): Promise<string> {
	const bridge = getDesktopBridge();
	if (!bridge) throw new Error("Desktop file copy is unavailable outside Tauri");
	const filename = `${id()}${extension(sourcePath, kind === "image" ? ".jpg" : "")}`;
	return bridge.invoke<string>(kind === "image" ? "copy_image" : "copy_attachment", kind === "image" ? { sourcePath, filename } : { sourcePath, noteId, filename });
}
export async function resolveLocalFile(path: string, type = "application/octet-stream"): Promise<string> {
	const desktop = getDesktopBridge();
	if (desktop?.convertFileSrc) return desktop.convertFileSrc(path);
	const cached = urls.get(path); if (cached) return cached;
	const bytes = await browserStorage.readFile(path); if (!bytes) throw new Error(`Local file not found: ${path}`);
	const url = URL.createObjectURL(new Blob([blobBytes(bytes)], { type })); urls.set(path, url); return url;
}
export function releaseLocalFile(path: string): void { const url = urls.get(path); if (url) URL.revokeObjectURL(url); urls.delete(path); }
export function readClipboardImage(event: ClipboardEvent): File | null { return Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith("image/")) ?? null; }
export async function writeClipboardText(text: string): Promise<boolean> { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }
export function downloadBytes(bytes: Uint8Array, filename: string, type = "application/octet-stream"): void {
	const url = URL.createObjectURL(new Blob([blobBytes(bytes)], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); queueMicrotask(() => URL.revokeObjectURL(url));
}
