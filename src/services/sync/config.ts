export function getSyncServerUrl(): string | null {
	const raw = process.env.EXPO_PUBLIC_SYNC_SERVER_URL ?? "";
	const trimmed = raw.trim().replace(/\/+$/, "");
	return trimmed.length > 0 ? trimmed : null;
}

export function isServerSyncEnabled(): boolean {
	return getSyncServerUrl() !== null;
}

export function isServerSyncConfigured(): boolean {
	return isServerSyncEnabled() && getSyncServerUrl() !== null;
}
