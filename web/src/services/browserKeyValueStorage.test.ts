import storage from "@/services/storage/browserKeyValueStorage";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
	const values = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
	});
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it("preserves existing client ID and split preference under original keys", async () => {
	localStorage.setItem("keeper:crdt:client-id", "existing-client");
	localStorage.setItem("doc-split-ratio", "0.65");
	expect(await storage.getItem("keeper:crdt:client-id")).toBe(
		"existing-client",
	);
	expect(await storage.getItem("doc-split-ratio")).toBe("0.65");
	await storage.setItem("doc-split-ratio", "0.55");
	expect(localStorage.getItem("doc-split-ratio")).toBe("0.55");
	expect(localStorage.getItem("keeper:crdt:client-id")).toBe("existing-client");
});

it("rejects unavailable storage rather than reporting successful persistence", async () => {
	const error = new DOMException("Storage blocked", "SecurityError");
	vi.spyOn(localStorage, "getItem").mockImplementation(() => {
		throw error;
	});
	vi.spyOn(localStorage, "setItem").mockImplementation(() => {
		throw error;
	});
	await expect(storage.getItem("keeper:crdt:client-id")).rejects.toBe(error);
	await expect(storage.setItem("keeper:crdt:client-id", "client")).rejects.toBe(
		error,
	);
});
