type PendingDispatchFlusher = () => void;

const flushers = new Map<string, PendingDispatchFlusher>();

export function registerPendingDispatchFlusher(
	key: string,
	flusher: PendingDispatchFlusher,
): void {
	flushers.set(key, flusher);
}

export function unregisterPendingDispatchFlusher(
	key: string,
	flusher?: PendingDispatchFlusher,
): void {
	if (flusher && flushers.get(key) !== flusher) {
		return;
	}
	flushers.delete(key);
}

export function flushAllPendingEditorDispatches(): void {
	for (const flusher of flushers.values()) {
		try {
			flusher();
		} catch (error) {
			console.warn("[Editor] Failed to flush pending dispatch:", error);
		}
	}
}
