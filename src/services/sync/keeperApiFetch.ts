import { getSyncServerUrl } from "@/services/sync/config";
import { getSyncAuthorizationHeaders } from "@/services/sync/cloudflareAccessAuth.web";

export async function keeperApiFetch(
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const serverUrl = getSyncServerUrl();
	if (!serverUrl) throw new Error("Sync server URL is not configured");

	const headers = new Headers(init.headers);
	for (const name of [
		"authorization",
		"cf-access-jwt-assertion",
		"x-keeper-access-jwt-assertion",
		"x-keeper-private-proxy-token",
	]) {
		headers.delete(name);
	}
	for (const [name, value] of Object.entries(
		await getSyncAuthorizationHeaders(),
	)) {
		headers.set(name, value);
	}

	return fetch(`${serverUrl}${path}`, {
		...init,
		headers,
		credentials: "include",
	});
}
