import type { StorageCapabilities } from "@/services/storage/types";
import { create } from "zustand";

type StorageInitializationStatus = "pending" | "ready" | "failed";

interface StorageState {
	capabilities: StorageCapabilities;
	initializationStatus: StorageInitializationStatus;
	initializationError?: string;
	contentVersion: number;
	notesRoot?: string;
	setCapabilities: (capabilities: StorageCapabilities) => void;
	bumpContentVersion: () => void;
	setInitializationPending: () => void;
	setInitializationReady: () => void;
	setInitializationFailed: (error: string) => void;
	setNotesRoot: (notesRoot?: string) => void;
}

const defaultCapabilities: StorageCapabilities = {
	backend: "mobile-native",
};
export const useStorageStore = create<StorageState>((set) => ({
	capabilities: defaultCapabilities,
	initializationStatus: "pending",
	initializationError: undefined,
	contentVersion: 0,
	notesRoot: undefined,
	setCapabilities: (capabilities) => set({ capabilities }),
	bumpContentVersion: () =>
		set((state) => ({ contentVersion: state.contentVersion + 1 })),
	setInitializationPending: () =>
		set({ initializationStatus: "pending", initializationError: undefined }),
	setInitializationReady: () =>
		set({
			initializationStatus: "ready",
			initializationError: undefined,
		}),
	setInitializationFailed: (error) =>
		set({
			initializationStatus: "failed",
			initializationError: error,
		}),
	setNotesRoot: (notesRoot) => set({ notesRoot }),
}));
