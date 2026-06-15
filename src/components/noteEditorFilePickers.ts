import { getDocumentAsync } from "expo-document-picker";
import { inferAttachmentType } from "@/services/notes/attachmentStorage";
import { copyPickedImageToNotes } from "@/services/notes/imageStorage";
import type { PickedDocumentResult } from "./noteEditorFilePickerTypes";

export async function pickEditorDocument(): Promise<PickedDocumentResult> {
  const result = await getDocumentAsync({
    type: ["application/pdf", "application/epub+zip"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return { status: "cancelled" };

  const asset = result.assets[0];
  const uri = asset.uri;
  const name = asset.name ?? asset.uri;
  const type = inferAttachmentType(name ?? uri);
  if (!type) return { status: "unsupported" };

  return { status: "picked", uri, name, type };
}

export async function pickEditorImage(): Promise<string | null> {
  const result = await getDocumentAsync({
    type: "image/*",
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;

  return copyPickedImageToNotes(result.assets[0].uri);
}
