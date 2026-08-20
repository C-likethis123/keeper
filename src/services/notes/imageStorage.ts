import { Directory, File } from "expo-file-system";
import { storageEngine } from "@/services/storage/storageEngine";
import { NOTES_ROOT } from "./Notes";

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

export async function saveImageBytesToNotes(
	data: Uint8Array,
	mimeType: string,
	name: string,
): Promise<string> {
	const relativePath = `assets/${uniqueId()}${getImageExtension(mimeType, name)}`;
	await storageEngine.writeFileBytes(relativePath, data);
	return relativePath;
}

export async function copyPickedImageToNotes(uri: string): Promise<string> {
	const ext = getExtension(uri);
	const filename = `${uniqueId()}${ext}`;
	const assetsDir = new Directory(NOTES_ROOT, "assets");
	if (!assetsDir.exists) {
		assetsDir.create({ intermediates: true });
	}
	const source = new File(uri);
	const dest = new File(assetsDir, filename);
	source.copy(dest);
	return `assets/${filename}`;
}

export function resolveImageUri(relativePath: string): string {
	if (/^[a-z][a-z0-9+.-]*:/i.test(relativePath)) {
		return relativePath;
	}

	const base = NOTES_ROOT.endsWith("/") ? NOTES_ROOT : `${NOTES_ROOT}/`;
	return `${base}${relativePath}`;
}
