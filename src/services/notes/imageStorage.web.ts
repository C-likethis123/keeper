import { getTauriInvoke } from "@/services/storage/runtime";
import { storageEngine } from "@/services/storage/storageEngine";
import { NOTES_ROOT } from "./Notes";

const objectUrls = new Map<string, string>();

type TauriConvertFileSrc = (path: string) => string;

function getTauriConvertFileSrc(): TauriConvertFileSrc | null {
	const tauriInternals = (
		globalThis as {
			__TAURI_INTERNALS__?: {
				convertFileSrc?: TauriConvertFileSrc;
			};
		}
	).__TAURI_INTERNALS__;

	return typeof tauriInternals?.convertFileSrc === "function"
		? tauriInternals.convertFileSrc
		: null;
}

function getExtension(uri: string): string {
	const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
	return match ? `.${match[1].toLowerCase()}` : ".jpg";
}

function uniqueId(): string {
	return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function getImageExtension(mimeType: string, name: string): string {
	const nameExtension = getExtension(name);
	if (nameExtension !== ".jpg" || /\.jpe?g(?:\?|$)/i.test(name)) {
		return nameExtension;
	}
	return (
		{
			"image/png": ".png",
			"image/gif": ".gif",
			"image/webp": ".webp",
			"image/bmp": ".bmp",
			"image/svg+xml": ".svg",
		}[mimeType] ?? ".jpg"
	);
}

function cacheObjectUrl(
	relativePath: string,
	data: Uint8Array,
	mimeType: string,
): string {
	const oldUrl = objectUrls.get(relativePath);
	if (oldUrl) URL.revokeObjectURL(oldUrl);
	const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
	objectUrls.set(relativePath, url);
	return url;
}

export async function saveImageBytesToNotes(
	data: Uint8Array,
	mimeType: string,
	name: string,
): Promise<string> {
	const relativePath = `assets/${uniqueId()}${getImageExtension(mimeType, name)}`;
	await storageEngine.writeFileBytes(relativePath, data);
	if (!getTauriInvoke()) cacheObjectUrl(relativePath, data, mimeType);
	return relativePath;
}

export async function copyPickedImageToNotes(uri: string): Promise<string> {
	const invoke = getTauriInvoke();
	if (invoke) {
		const filename = `${uniqueId()}${getExtension(uri)}`;
		return invoke<string>("copy_image", { sourcePath: uri, filename });
	}
	const response = await fetch(uri);
	if (!response.ok) throw new Error("Could not read selected image");
	const mimeType = response.headers.get("content-type") || "image/jpeg";
	const relativePath = await saveImageBytesToNotes(
		new Uint8Array(await response.arrayBuffer()),
		mimeType,
		uri,
	);
	URL.revokeObjectURL(uri);
	return relativePath;
}

export async function resolveImageUri(relativePath: string): Promise<string> {
	if (/^[a-z][a-z0-9+.-]*:/i.test(relativePath)) {
		return relativePath;
	}
	if (!getTauriInvoke()) {
		const cachedUrl = objectUrls.get(relativePath);
		if (cachedUrl) return cachedUrl;
		const bytes = await storageEngine.readFileBytes(relativePath);
		if (!bytes) throw new Error(`Image not found: ${relativePath}`);
		return cacheObjectUrl(relativePath, bytes, "image/*");
	}

	const base = NOTES_ROOT.endsWith("/") ? NOTES_ROOT.slice(0, -1) : NOTES_ROOT;
	const absolutePath = `${base}/${relativePath}`;
	const convertFileSrc = getTauriConvertFileSrc();
	return convertFileSrc ? convertFileSrc(absolutePath) : absolutePath;
}

export function releaseImageUri(relativePath: string): void {
	if (getTauriInvoke()) return;
	const objectUrl = objectUrls.get(relativePath);
	if (objectUrl) URL.revokeObjectURL(objectUrl);
	objectUrls.delete(relativePath);
}
