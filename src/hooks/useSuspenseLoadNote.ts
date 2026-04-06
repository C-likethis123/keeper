import { getCachedQueryPromise } from "@/services/notes/noteQueryCache";
import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { useStorageStore } from "@/stores/storageStore";
import { waitForStorageReady } from "@/stores/storageSuspense";
import { use } from "react";

export function useSuspenseLoadNote(id: string): Note | null {
	const initializationStatus = useStorageStore((s) => s.initializationStatus);
	const initializationError = useStorageStore((s) => s.initializationError);

	// Deliberately NOT using contentVersion in the cache key.
	// contentVersion is for list-level refresh (useNotes).
	// Including it here would cause re-suspension on every save, which
	// unmounts/remounts the editor via the Suspense boundary and loses focus.
	// The note content on disk is what we just saved, so stale data isn't a concern.
	if (initializationStatus === "pending") {
		throw waitForStorageReady();
	}

	if (initializationStatus === "failed") {
		throw new Error(initializationError ?? "Storage is unavailable");
	}

	return use(
		getCachedQueryPromise(`note:${id}`, () => NoteService.loadNote(id)),
	);
}
