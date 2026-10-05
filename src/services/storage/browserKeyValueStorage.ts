/** Keep legacy AsyncStorage web keys readable without a data migration. */
const browserKeyValueStorage = {
	async getItem(key: string): Promise<string | null> {
		return window.localStorage.getItem(key);
	},
	async setItem(key: string, value: string): Promise<void> {
		window.localStorage.setItem(key, value);
	},
};

export default browserKeyValueStorage;
