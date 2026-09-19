import { getSyncServerUrl } from "@/services/sync/config";
import { getSyncAuthorizationHeaders } from "@/services/sync/cloudflareAccessAuth.web";

export async function keeperApiFetch(
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const serverUrl = getSyncServerUrl();
	if (!serverUrl) throw new Error("Sync server URL is not configured");

	return fetch(`${serverUrl}${path}`, {
		...init,
		headers: {
			...(await getSyncAuthorizationHeaders()),
			...init.headers,
		},
		credentials: "include",
	});
}
