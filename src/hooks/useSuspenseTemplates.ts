import { getCachedQueryPromise } from "@/services/notes/noteQueryCache";
import { NotesIndexService } from "@/services/notes/notesIndex";
import type { Note } from "@/services/notes/types";
import { useStorageStore } from "@/stores/storageStore";
import { waitForStorageReady } from "@/stores/storageSuspense";
import { use } from "react";

function buildTemplatesQueryKey(refreshVersion: number) {
	return JSON.stringify({ scope: "templates", refreshVersion });
}

export default function useSuspenseTemplates(): Note[] {
	const initializationStatus = useStorageStore((s) => s.initializationStatus);
	const initializationError = useStorageStore((s) => s.initializationError);

	if (initializationStatus === "pending") {
		throw waitForStorageReady();
	}

	if (initializationStatus === "failed") {
		throw new Error(initializationError ?? "Storage is unavailable");
	}

	const key = buildTemplatesQueryKey(0);
	const result = use(
		getCachedQueryPromise(key, () =>
			NotesIndexService.listNotes("", 100, 0, { noteTypes: ["template"] }),
		),
	);

	return result.items.map((item) => ({
		id: item.noteId,
		title: item.title,
		content: item.summary ?? "",
		lastUpdated: item.updatedAt,
		isPinned: item.isPinned,
		noteType: item.noteType,
		status: item.status,
	}));
}
