import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "keeper:video_position:";

function storageKey(rawUrl: string): string {
  return `${STORAGE_PREFIX}${rawUrl}`;
}

export async function saveVideoPosition(
  rawUrl: string,
  seconds: number,
): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(rawUrl), String(seconds));
  } catch {
    // Ignore write failures — position tracking is best-effort
  }
}

export async function getVideoPosition(rawUrl: string): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(storageKey(rawUrl));
    if (value === null) return 0;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export async function clearVideoPosition(rawUrl: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(rawUrl));
  } catch {
    // Ignore
  }
}
