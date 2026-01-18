import AsyncStorage from "@react-native-async-storage/async-storage";

const FOLDER_KEY = "note_folder";

export async function loadFolder(): Promise<string | null> {
  return await AsyncStorage.getItem(FOLDER_KEY);
}

export async function saveFolder(path: string): Promise<void> {
  await AsyncStorage.setItem(FOLDER_KEY, path);
}

export async function clearFolder(): Promise<void> {
  await AsyncStorage.removeItem(FOLDER_KEY);
}

