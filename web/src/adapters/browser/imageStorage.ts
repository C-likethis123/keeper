/** Browser media storage owns URLs; canonical image node only needs resolution. */
export async function resolveImageUri(uri: string) { return uri; }
export function releaseImageUri(_uri: string) {}
