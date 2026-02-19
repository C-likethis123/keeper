import * as Updates from 'expo-updates';

export async function checkForUpdates() {
    try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
        }
    } catch (e) {
        console.error('Update check failed:', e);
    }
}
