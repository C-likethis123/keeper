import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "notes-meta";

export type PinnedMap = Record<string, boolean>;

function getStoredState(
  raw: string | null
): { pinned: PinnedMap } {
  if (!raw) return { pinned: {} };
  const parsed = JSON.parse(raw) as unknown;
  if (parsed && typeof parsed === "object" && "state" in parsed) {
    const state = (parsed as { state?: { pinned?: PinnedMap } }).state;
    return { pinned: state?.pinned ?? {} };
  }
  if (parsed && typeof parsed === "object" && "pinned" in parsed) {
    return { pinned: (parsed as { pinned: PinnedMap }).pinned ?? {} };
  }
  return { pinned: {} };
}

export class NotesMetaService {
  static instance = new NotesMetaService();

  private constructor() { }

  static async getPinned(filePath: string): Promise<boolean> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return getStoredState(raw).pinned[filePath] ?? false;
  }

  static async getPinnedMap(): Promise<PinnedMap> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return getStoredState(raw).pinned;
  }

  static async setPinned(filePath: string, value: boolean): Promise<void> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const { pinned } = getStoredState(raw);
    const next = { ...pinned, [filePath]: value };
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { pinned: next }, version: 1 })
    );
  }

  static async removePin(filePath: string): Promise<void> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const { pinned } = getStoredState(raw);
    delete pinned[filePath];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { pinned }, version: 1 }));
  }
}
