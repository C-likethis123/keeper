export function getSyncServerUrl(): string | null {
	const raw =
		process.env.EXPO_PUBLIC_SYNC_SERVER_URL ??
		process.env.EXPO_PUBLIC_GIT_API_URL ??
		"";
	const trimmed = raw.trim().replace(/\/+$/, "");
	return trimmed.length > 0 ? trimmed : null;
}

export function isServerSyncEnabled(): boolean {
	return process.env.EXPO_PUBLIC_SERVER_SYNC_ENABLED === "true";
}
