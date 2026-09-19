import { browserStorage } from "@/services/storage";

const DEVICE_ID_KEY = "sync:device-id";
function serverUrl(): string | null { return import.meta.env.VITE_SYNC_SERVER_URL?.trim().replace(/\/+$/, "") || null; }
/** Cloudflare Access browser sessions use its cookie. Never persist a bearer token. */
export async function syncFetch(path: string, init: RequestInit = {}): Promise<Response> {
	const origin = serverUrl(); if (!origin) throw new Error("VITE_SYNC_SERVER_URL is not configured");
	return fetch(`${origin}${path}`, { ...init, credentials: "include" });
}
export async function getSyncDeviceId(): Promise<string> {
	const existing = await browserStorage.getState(DEVICE_ID_KEY); if (existing) return existing;
	const id = `device-${crypto.randomUUID()}`; await browserStorage.setState(DEVICE_ID_KEY, id); return id;
}
