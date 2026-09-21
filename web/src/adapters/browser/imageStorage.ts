import { releaseLocalFile, resolveLocalFile } from "@web/services/media";

/** Browser media storage owns URLs; canonical image node only needs resolution. */
export async function resolveImageUri(uri: string) { return uri.startsWith("assets/") ? resolveLocalFile(uri, "image/*") : uri; }
export function releaseImageUri(uri: string) { if (uri.startsWith("assets/")) releaseLocalFile(uri); }
