export async function checkForUpdates() {
        try {
                const Updates = await import("expo-updates");
                console.log("[Updates] Checking for updates...");
                const update = await Updates.checkForUpdateAsync();
                console.log("[Updates] Check result:", update);
                if (update.isAvailable) {
                        console.log("[Updates] Update available, fetching...");
                        await Updates.fetchUpdateAsync();
                        console.log("[Updates] Update fetched, reloading...");
                        await Updates.reloadAsync();
                } else {
                        console.log("[Updates] No update available.");
                }
        } catch (e) {
                console.error("Update check failed:", e);
        }
}
