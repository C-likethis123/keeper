import { browserStorage } from "@web/services/storage";

const DEVICE_ID_KEY = "keeper:sync:device-id";
const LEGACY_DEVICE_ID_KEY = "sync:device-id";
let devicePromise: Promise<string> | null = null;
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
export async function getSyncDeviceId(): Promise<string> {
	if (devicePromise) return devicePromise;
	devicePromise = (async () => {
		const existing = await browserStorage.getState(DEVICE_ID_KEY);
		if (existing) return existing;
		const legacy = await browserStorage.getState(LEGACY_DEVICE_ID_KEY);
		if (legacy) {
			await browserStorage.setState(DEVICE_ID_KEY, legacy);
			return legacy;
		}
		const id = `device-${crypto.randomUUID()}`;
		await browserStorage.setState(DEVICE_ID_KEY, id);
		return id;
	})();
	try {
		return await devicePromise;
	} finally {
		devicePromise = null;
	}
}
