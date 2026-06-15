import type { AttachmentType } from "@/services/notes/attachmentStorage";

export type PickedDocumentResult =
  | {
      status: "picked";
      uri: string;
      name: string;
      type: AttachmentType;
    }
  | { status: "cancelled" }
  | { status: "unsupported" };
