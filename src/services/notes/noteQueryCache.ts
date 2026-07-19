const queryCache = new Map<string, Promise<unknown>>();
const promiseStates = new WeakMap<Promise<unknown>, { status: string; value?: unknown; error?: unknown }>();

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

export function useSuspensePromise<T>(promise: Promise<T>): T {
	let state = promiseStates.get(promise);
	if (!state) {
		state = { status: "pending" };
		const pendingState = state;
		promiseStates.set(promise, state);
		void promise.then((value) => { pendingState.status = "fulfilled"; pendingState.value = value; }, (error) => { pendingState.status = "rejected"; pendingState.error = error; });
	}
	if (state.status === "pending") throw promise;
	if (state.status === "rejected") throw state.error;
	return state.value as T;
}

export function invalidateNoteQueryCache() {
	queryCache.clear();
}
