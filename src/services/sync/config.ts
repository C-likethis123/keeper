let configuredSyncServerUrl: string | null | undefined;

function normalizeSyncServerUrl(value: string | null | undefined): string | null {
	const trimmed = (value ?? "").trim().replace(/\/+$/, "");
	return trimmed.length > 0 ? trimmed : null;
}

/** Browser entrypoints inject Vite configuration here without requiring Node globals. */
export function configureSyncServerUrl(value: string | null | undefined): void {
	configuredSyncServerUrl = normalizeSyncServerUrl(value);
}

export function getSyncServerUrl(): string | null {
	if (configuredSyncServerUrl !== undefined) return configuredSyncServerUrl;
	return normalizeSyncServerUrl(
		typeof process === "undefined"
			? null
			: process.env.EXPO_PUBLIC_SYNC_SERVER_URL,
	);
}

export function isServerSyncEnabled(): boolean {
	return getSyncServerUrl() !== null;
}

export function isServerSyncConfigured(): boolean {
	return isServerSyncEnabled() && getSyncServerUrl() !== null;
}
