import { open } from "@tauri-apps/plugin-dialog";
import { inferAttachmentType } from "@/services/notes/attachmentStorage";
import { copyPickedImageToNotes } from "@/services/notes/imageStorage.web";
import type { PickedDocumentResult } from "./noteEditorFilePickerTypes";

export async function pickEditorDocument(): Promise<PickedDocumentResult> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Documents", extensions: ["pdf", "epub"] }],
  });
  if (!selected || Array.isArray(selected)) return { status: "cancelled" };

  const name = selected.split(/[\\/]/).pop() ?? selected;
  const type = inferAttachmentType(name ?? selected);
  if (!type) return { status: "unsupported" };

  return { status: "picked", uri: selected, name, type };
}

export async function pickEditorImage(): Promise<string | null> {
  const selected = await open({
    title: "Select Image",
    multiple: false,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico"],
      },
    ],
  });
  if (selected === null || Array.isArray(selected)) return null;

  return copyPickedImageToNotes(selected);
}
