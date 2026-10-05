import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
	cleanup();
});

vi.mock("nanoid", () => ({ nanoid: () => "generated-note-id" }));

vi.mock("@/services/storage/browserKeyValueStorage", () => {
	let store: Record<string, string> = {};
	return {
		default: {
			getItem: vi.fn(async (key: string) => store[key] ?? null),
			setItem: vi.fn(async (key: string, value: string) => {
				store[key] = value;
			}),
			removeItem: vi.fn(async (key: string) => {
				delete store[key];
			}),
			clear: vi.fn(async () => {
				store = {};
			}),
		},
	};
});
