const queryCache = new Map<string, Promise<unknown>>();

export function getCachedQueryPromise<T>(
	key: string,
	load: () => Promise<T>,
): Promise<T> {
	const cached = queryCache.get(key);
	if (cached) {
		return cached as Promise<T>;
	}

	const promise = load();
	queryCache.set(key, promise);
	return promise;
}

export function invalidateNoteQueryCache() {
	queryCache.clear();
}
