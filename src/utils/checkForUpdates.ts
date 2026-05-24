export async function checkForUpdates(
	onStatusChange?: (message: string) => void,
) {
	try {
		const Updates = await import("expo-updates");
		onStatusChange?.("Checking for updates...");
		console.log("[Updates] Checking for updates...");
		const update = await Updates.checkForUpdateAsync();
		console.log("[Updates] Check result:", update);
		if (update.isAvailable) {
			onStatusChange?.("Downloading update...");
			console.log("[Updates] Update available, fetching...");
			await Updates.fetchUpdateAsync();
			console.log("[Updates] Update fetched, reloading...");
			await Updates.reloadAsync();
		} else {
			onStatusChange?.("");
			console.log("[Updates] No update available.");
		}
	} catch (e) {
		onStatusChange?.("");
		console.error("Update check failed:", e);
	}
}
