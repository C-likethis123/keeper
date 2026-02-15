import { File, Directory } from 'expo-file-system';
import { Linking, Platform, Alert } from 'react-native';
import { NOTES_ROOT } from '@/services/notes/Notes';

const SENTINEL_NAME = '.writable_test';

export async function ensureNotesDirectoryWritable(): Promise<{ ok: boolean; error?: string }> {
    try {
        const dir = new Directory(NOTES_ROOT);
        if (!dir.exists) {
            dir.create({ intermediates: true });
        }
        const sentinelPath = `${NOTES_ROOT}${SENTINEL_NAME}`;
        const file = new File(sentinelPath);
        if (!file.exists) {
            file.create();
        }
        file.write('ok');
        file.delete();
        return { ok: true };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, error: message };
    }
}

export function openAppSettings(): void {
    if (Platform.OS === 'web') {
        return;
    }
    Linking.openSettings();
}

const STORAGE_ALERT_TITLE = 'Storage access needed';
const STORAGE_ALERT_MESSAGE =
    'This app needs access to store notes and sync with Git. Please grant storage access in settings.';
const STORAGE_ALERT_OPEN = 'Open settings';
const STORAGE_ALERT_CANCEL = 'Cancel';

export function showStoragePermissionAlertAndOpenSettings(): void {
    if (Platform.OS === 'web') {
        return;
    }
    Alert.alert(STORAGE_ALERT_TITLE, STORAGE_ALERT_MESSAGE, [
        { text: STORAGE_ALERT_CANCEL, style: 'cancel' },
        { text: STORAGE_ALERT_OPEN, onPress: openAppSettings },
    ]);
}

export function isPermissionLikeError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
        lower.includes('permission') ||
        lower.includes('rejected') ||
        lower.includes('eacces') ||
        lower.includes('eperm') ||
        lower.includes('unable to delete') ||
        lower.includes('filesystemdirectory')
    );
}
