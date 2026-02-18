import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "notes-meta";

export type PinnedMap = Record<string, boolean>;
export type TitlesMap = Record<string, string>;

type StoredState = { pinned: PinnedMap; titles: TitlesMap };

function getStoredState(raw: string | null): StoredState {
	if (!raw) return { pinned: {}, titles: {} };
	const parsed = JSON.parse(raw) as unknown;
	if (parsed && typeof parsed === "object" && "state" in parsed) {
		const state = (parsed as { state?: { pinned?: PinnedMap; titles?: TitlesMap } })
			.state;
		return {
			pinned: state?.pinned ?? {},
			titles: state?.titles ?? {},
		};
	}
	if (parsed && typeof parsed === "object" && "pinned" in parsed) {
		return {
			pinned: (parsed as { pinned: PinnedMap }).pinned ?? {},
			titles: (parsed as { titles?: TitlesMap }).titles ?? {},
		};
	}
	return { pinned: {}, titles: {} };
}

function setStoredState(update: (prev: StoredState) => StoredState): Promise<void> {
	return AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
		const prev = getStoredState(raw);
		const next = update(prev);
		return AsyncStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				state: { pinned: next.pinned, titles: next.titles },
				version: 1,
			}),
		);
	});
}

export class NotesMetaService {
	static instance = new NotesMetaService();

	private constructor() {}

	static async getPinned(filePath: string): Promise<boolean> {
		const raw = await AsyncStorage.getItem(STORAGE_KEY);
		return getStoredState(raw).pinned[filePath] ?? false;
	}

	static async getPinnedMap(): Promise<PinnedMap> {
		const raw = await AsyncStorage.getItem(STORAGE_KEY);
		return getStoredState(raw).pinned;
	}

	static async setPinned(filePath: string, value: boolean): Promise<void> {
		await setStoredState((prev) => ({
			...prev,
			pinned: { ...prev.pinned, [filePath]: value },
		}));
	}

	static async getTitlesMap(): Promise<TitlesMap> {
		const raw = await AsyncStorage.getItem(STORAGE_KEY);
		return getStoredState(raw).titles;
	}

	static async getTitle(filePath: string): Promise<string | undefined> {
		const titles = await this.getTitlesMap();
		return titles[filePath];
	}

	static async setTitle(filePath: string, title: string): Promise<void> {
		await setStoredState((prev) => ({
			...prev,
			titles: { ...prev.titles, [filePath]: title },
		}));
	}

	static async removePin(filePath: string): Promise<void> {
		await setStoredState((prev) => {
			const pinned = { ...prev.pinned };
			delete pinned[filePath];
			return { ...prev, pinned };
		});
	}

	static async removeTitle(filePath: string): Promise<void> {
		await setStoredState((prev) => {
			const titles = { ...prev.titles };
			delete titles[filePath];
			return { ...prev, titles };
		});
	}
}
