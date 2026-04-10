import { getTauriInvoke } from "@/services/storage/runtime";

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
