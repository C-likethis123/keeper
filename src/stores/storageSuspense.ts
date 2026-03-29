import { useStorageStore } from "./storageStore";

let pendingStoragePromise: Promise<void> | null = null;

export function waitForStorageReady(): Promise<void> {
	const state = useStorageStore.getState();
	if (state.initializationStatus === "ready") {
		return Promise.resolve();
	}

	if (state.initializationStatus === "failed") {
		return Promise.reject(
			new Error(state.initializationError ?? "Storage is unavailable"),
		);
	}

	if (pendingStoragePromise) {
		return pendingStoragePromise;
	}

	pendingStoragePromise = new Promise<void>((resolve, reject) => {
		const unsubscribe = useStorageStore.subscribe((nextState) => {
			if (nextState.initializationStatus === "ready") {
				pendingStoragePromise = null;
				unsubscribe();
				resolve();
				return;
			}

			if (nextState.initializationStatus === "failed") {
				pendingStoragePromise = null;
				unsubscribe();
				reject(
					new Error(nextState.initializationError ?? "Storage is unavailable"),
				);
			}
		});
	});

	return pendingStoragePromise;
}
