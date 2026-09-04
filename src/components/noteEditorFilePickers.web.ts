import { inferAttachmentType } from "@/services/notes/attachmentStorage";
import { copyPickedImageToNotes } from "@/services/notes/imageStorage.web";
import { getTauriInvoke } from "@/services/storage/runtime";
import type { PickedDocumentResult } from "./noteEditorFilePickerTypes";

type TauriDialog = {
	open(options: {
		title?: string;
		multiple: false;
		filters: { name: string; extensions: string[] }[];
	}): Promise<string | string[] | null>;
};

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

async function openTauriDialog(): Promise<TauriDialog | null> {
	if (!getTauriInvoke()) return null;
	return import("@tauri-apps/plugin-dialog");
}

export async function pickEditorDocument(): Promise<PickedDocumentResult> {
  const dialog = await openTauriDialog();
  if (dialog) {
    const selected = await dialog.open({
      multiple: false,
      filters: [{ name: "Documents", extensions: ["pdf", "epub"] }],
    });
    if (!selected || Array.isArray(selected)) return { status: "cancelled" };

    const name = selected.split(/[\\/]/).pop() ?? selected;
    const type = inferAttachmentType(name);
    return type ? { status: "picked", uri: selected, name, type } : { status: "unsupported" };
  }

  const file = await pickBrowserFile("application/pdf,application/epub+zip,.pdf,.epub");
  if (!file) return { status: "cancelled" };
  const type = inferAttachmentType(file.name);
  return type
    ? { status: "picked", uri: URL.createObjectURL(file), name: file.name, type }
    : { status: "unsupported" };
}

export async function pickEditorImage(): Promise<string | null> {
  const dialog = await openTauriDialog();
  if (dialog) {
    const selected = await dialog.open({
      title: "Select Image",
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico"] }],
    });
    return !selected || Array.isArray(selected) ? null : copyPickedImageToNotes(selected);
  }

  const file = await pickBrowserFile("image/*");
  return file ? copyPickedImageToNotes(URL.createObjectURL(file)) : null;
}
