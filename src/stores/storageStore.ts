import { create } from "zustand";

type StorageInitializationStatus = "pending" | "ready" | "failed";

interface StorageState {
	initializationStatus: StorageInitializationStatus;
	initializationError?: string;
	contentVersion: number;
	notesRoot?: string;
	bumpContentVersion: () => void;
	setInitializationPending: () => void;
	setInitializationReady: () => void;
	setInitializationFailed: (error: string) => void;
	setNotesRoot: (notesRoot?: string) => void;
}

export const useStorageStore = create<StorageState>((set) => ({
	initializationStatus: "pending",
	initializationError: undefined,
	contentVersion: 0,
	notesRoot: undefined,
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
