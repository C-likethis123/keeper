import { getTauriInvoke } from "@/services/storage/runtime";
import { convertFileSrc } from "@tauri-apps/api/core";
import { NOTES_ROOT } from "./Notes";

function getExtension(uri: string): string {
	const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
	return match ? `.${match[1].toLowerCase()}` : ".jpg";
}

function uniqueId(): string {
	return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function copyPickedImageToNotes(uri: string): Promise<string> {
	const invoke = getTauriInvoke();
	if (!invoke) throw new Error("Tauri invoke unavailable");
	const ext = getExtension(uri);
	const filename = `${uniqueId()}${ext}`;
	const relativePath = await invoke<string>("copy_image", {
		sourcePath: uri,
		filename,
	});
	return relativePath;
}

export function resolveImageUri(relativePath: string): string {
	if (/^[a-z][a-z0-9+.-]*:/i.test(relativePath)) {
		return relativePath;
	}

	const base = NOTES_ROOT.endsWith("/") ? NOTES_ROOT.slice(0, -1) : NOTES_ROOT;
	return convertFileSrc(`${base}/${relativePath}`);
}
