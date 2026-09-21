import { releaseLocalFile, resolveLocalFile } from "@web/services/media";

export type AttachmentType = "pdf" | "epub";
export function inferAttachmentType(path: string): AttachmentType | null { return path.toLocaleLowerCase().endsWith(".pdf") ? "pdf" : path.toLocaleLowerCase().endsWith(".epub") ? "epub" : null; }
export async function resolveAttachmentUri(path: string) { return resolveLocalFile(path, inferAttachmentType(path) === "pdf" ? "application/pdf" : "application/epub+zip"); }
export function releaseAttachmentUri(path: string) { releaseLocalFile(path); }
