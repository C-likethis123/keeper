import { getCachedQueryPromise } from "@/services/notes/noteQueryCache";
import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { useStorageStore } from "@/stores/storageStore";
import { waitForStorageReady } from "@/stores/storageSuspense";
import { use } from "react";

export function useSuspenseLoadNote(id: string): Note | null {
	const initializationStatus = useStorageStore((s) => s.initializationStatus);
	const initializationError = useStorageStore((s) => s.initializationError);
	const contentVersion = useStorageStore((s) => s.contentVersion);

	if (initializationStatus === "pending") {
		throw waitForStorageReady();
	}

	if (initializationStatus === "failed") {
		throw new Error(initializationError ?? "Storage is unavailable");
	}

	return use(
		getCachedQueryPromise(`note:${id}:v${contentVersion}`, () =>
			NoteService.loadNote(id),
		),
	);
}
