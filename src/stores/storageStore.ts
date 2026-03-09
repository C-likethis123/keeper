import type { StorageBackend, StorageCapabilities } from "@/services/storage/types";
import { create } from "zustand";

interface StorageState {
	capabilities: StorageCapabilities;
	notesRoot?: string;
	setCapabilities: (capabilities: StorageCapabilities) => void;
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
	notesRoot: undefined,
	setCapabilities: (capabilities) => set({ capabilities }),
	setReadOnly: (reason, backend = "mobile-native") =>
		set({
			capabilities: {
				backend,
				canWrite: false,
				canSearch: false,
				reason,
			},
		}),
	setNotesRoot: (notesRoot) => set({ notesRoot }),
}));
