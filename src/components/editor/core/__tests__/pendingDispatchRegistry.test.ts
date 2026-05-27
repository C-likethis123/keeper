import {
	flushAllPendingEditorDispatches,
	registerPendingDispatchFlusher,
	unregisterPendingDispatchFlusher,
} from "../pendingDispatchRegistry";

describe("pendingDispatchRegistry", () => {
	afterEach(() => {
		unregisterPendingDispatchFlusher("test-key");
	});

	it("does not let an old flusher cleanup remove a newer flusher for the same key", () => {
		const oldFlusher = jest.fn();
		const newFlusher = jest.fn();

		registerPendingDispatchFlusher("test-key", oldFlusher);
		registerPendingDispatchFlusher("test-key", newFlusher);
		unregisterPendingDispatchFlusher("test-key", oldFlusher);

		flushAllPendingEditorDispatches();

		expect(oldFlusher).not.toHaveBeenCalled();
		expect(newFlusher).toHaveBeenCalledTimes(1);
	});
});
