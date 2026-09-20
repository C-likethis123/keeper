import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

if (!crypto.randomUUID) {
	Object.defineProperty(crypto, "randomUUID", {
		value: () => "test-note-id",
	});
}
