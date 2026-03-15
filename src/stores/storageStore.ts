import type { StorageBackend, StorageCapabilities } from "@/services/storage/types";
import { create } from "zustand";

type StorageInitializationStatus = "pending" | "ready" | "failed";

interface StorageState {
	capabilities: StorageCapabilities;
	initializationStatus: StorageInitializationStatus;
	contentVersion: number;
	notesRoot?: string;
	setCapabilities: (capabilities: StorageCapabilities) => void;
	bumpContentVersion: () => void;
	setInitializationPending: () => void;
	setInitializationReady: () => void;
	setReadOnly: (reason: string, backend?: StorageBackend) => void;
	setNotesRoot: (notesRoot?: string) => void;
}

const defaultCapabilities: StorageCapabilities = {
	backend: "mobile-native",
	canWrite: true,
	canSearch: true,
};

export const useStorageStore = create<StorageState>((set) => ({
	capabilities: defaultCapabilities,
	initializationStatus: "pending",
	contentVersion: 0,
	notesRoot: undefined,
	setCapabilities: (capabilities) => set({ capabilities }),
	bumpContentVersion: () =>
		set((state) => ({ contentVersion: state.contentVersion + 1 })),
	setInitializationPending: () => set({ initializationStatus: "pending" }),
	setInitializationReady: () => set({ initializationStatus: "ready" }),
	setReadOnly: (reason, backend = "mobile-native") =>
		set({
			capabilities: {
				backend,
				canWrite: false,
				canSearch: false,
				reason,
			},
			initializationStatus: "failed",
		}),
	setNotesRoot: (notesRoot) => set({ notesRoot }),
}));
