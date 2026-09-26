import { inferAttachmentType } from "@/services/notes/attachmentStorage";
import { copyPickedImageToNotes } from "@/services/notes/imageStorage.web";
import type { PickedDocumentResult } from "./noteEditorFilePickerTypes";

function pickBrowserFile(accept: string): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.addEventListener("change", () => resolve(input.files?.[0] ?? null), {
			once: true,
		});
		input.addEventListener("cancel", () => resolve(null), { once: true });
		input.click();
	});
}

export async function pickEditorDocument(): Promise<PickedDocumentResult> {
	const file = await pickBrowserFile(
		"application/pdf,application/epub+zip,.pdf,.epub",
	);
	if (!file) return { status: "cancelled" };
	const type = inferAttachmentType(file.name);
	return type
		? {
				status: "picked",
				uri: URL.createObjectURL(file),
				name: file.name,
				type,
			}
		: { status: "unsupported" };
}

export async function pickEditorImage(): Promise<string | null> {
	const file = await pickBrowserFile("image/*");
	return file ? copyPickedImageToNotes(URL.createObjectURL(file)) : null;
}
