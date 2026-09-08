import { getSyncServerUrl } from "@/services/sync/config";

export async function keeperApiFetch(
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const serverUrl = getSyncServerUrl();
	if (!serverUrl) throw new Error("Sync server URL is not configured");

	return fetch(`${serverUrl}${path}`, {
		...init,
		credentials: "include",
	});
}
