import {
	releaseImageUri as releaseCanonicalImageUri,
	resolveImageUri as resolveCanonicalImageUri,
	saveImageBytesToNotes as saveCanonicalImageBytesToNotes,
} from "@keeper/services/notes/imageStorage.web";
import { ensureCanonicalStorageInitialized } from "@web/services/canonicalStorage";

export async function saveImageBytesToNotes(
	bytes: Uint8Array,
	mimeType: string,
	name: string,
): Promise<string> {
	await ensureCanonicalStorageInitialized();
	return saveCanonicalImageBytesToNotes(bytes, mimeType, name);
}

export async function resolveImageUri(uri: string): Promise<string> {
	await ensureCanonicalStorageInitialized();
	return resolveCanonicalImageUri(uri);
}

export function releaseImageUri(uri: string): void {
	releaseCanonicalImageUri(uri);
}
