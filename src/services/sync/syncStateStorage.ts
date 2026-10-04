import browserKeyValueStorage from "@/services/storage/browserKeyValueStorage";
export async function getSyncStateItem(key: string): Promise<string | null> {
	return browserKeyValueStorage.getItem(key);
}

export async function setSyncStateItem(
	key: string,
	value: string,
): Promise<void> {
	await browserKeyValueStorage.setItem(key, value);
}
