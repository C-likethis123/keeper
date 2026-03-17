export async function checkForUpdates() {
	try {
		const Updates = await import("expo-updates");
		const update = await Updates.checkForUpdateAsync();
		if (update.isAvailable) {
			await Updates.fetchUpdateAsync();
			await Updates.reloadAsync();
		}
	} catch (e) {
		console.error("Update check failed:", e);
	}
}
