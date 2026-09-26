import { storageEngine } from "@/services/storage/storageEngine";

const objectUrls = new Map<string, string>();

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
	cacheObjectUrl(relativePath, data, mimeType);
	return relativePath;
}

export async function copyPickedImageToNotes(uri: string): Promise<string> {
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
	const cachedUrl = objectUrls.get(relativePath);
	if (cachedUrl) return cachedUrl;
	const bytes = await storageEngine.readFileBytes(relativePath);
	if (!bytes) throw new Error(`Image not found: ${relativePath}`);
	return cacheObjectUrl(relativePath, bytes, "image/*");
}

export function releaseImageUri(relativePath: string): void {
	const objectUrl = objectUrls.get(relativePath);
	if (objectUrl) URL.revokeObjectURL(objectUrl);
	objectUrls.delete(relativePath);
}
