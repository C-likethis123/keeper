import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "doc-position:";

export async function saveDocumentPosition(
	noteId: string,
	attachmentPath: string,
	position: string,
): Promise<void> {
	const key = `${PREFIX}${noteId}:${attachmentPath}`;
	await AsyncStorage.setItem(key, position);
}

export async function loadDocumentPosition(
	noteId: string,
	attachmentPath: string,
): Promise<string | null> {
	const key = `${PREFIX}${noteId}:${attachmentPath}`;
	return AsyncStorage.getItem(key);
}

export async function clearDocumentPosition(
	noteId: string,
	attachmentPath: string,
): Promise<void> {
	const key = `${PREFIX}${noteId}:${attachmentPath}`;
	await AsyncStorage.removeItem(key);
}
