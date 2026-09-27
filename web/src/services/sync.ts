export { getSyncDeviceId } from "@keeper/services/sync/syncOpQueue";

function serverUrl(): string | null {
	return (
		(
			import.meta.env.VITE_SYNC_SERVER_URL ??
			import.meta.env.EXPO_PUBLIC_SYNC_SERVER_URL
		)
			?.trim()
			.replace(/\/+$/, "") || null
	);
}
export function isBrowserSyncConfigured(): boolean {
	return serverUrl() !== null;
}
/** Cloudflare Access browser sessions use its cookie. Never persist a bearer token. */
export async function syncFetch(
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const origin = serverUrl();
	if (!origin) throw new Error("VITE_SYNC_SERVER_URL is not configured");
	return fetch(`${origin}${path}`, { ...init, credentials: "include" });
}
