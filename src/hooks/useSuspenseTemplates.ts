import { getCachedQueryPromise } from "@/services/notes/noteQueryCache";
import { NoteService } from "@/services/notes/noteService";
import { NotesIndexService } from "@/services/notes/notesIndex";
import type { Note } from "@/services/notes/types";
import { useStorageStore } from "@/stores/storageStore";
import { waitForStorageReady } from "@/stores/storageSuspense";
import { use } from "react";

function buildTemplatesQueryKey(args: {
	contentVersion: number;
	refreshVersion: number;
}) {
	return JSON.stringify({ scope: "templates", ...args });
}

async function loadTemplates(): Promise<Note[]> {
	const result = await NotesIndexService.listNotes("", 100, 0, {
		noteTypes: ["template"],
	});

	if (result.items.length > 0) {
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

	const fallback = await NoteService.listNotesFallback("", 100, 0, {
		noteTypes: ["template"],
	});

	return fallback.items.map((item) => ({
		id: item.noteId,
		title: item.title,
		content: item.summary ?? "",
		lastUpdated: item.updatedAt,
		isPinned: item.isPinned,
		noteType: item.noteType,
		status: item.status,
	}));
}

export default function useSuspenseTemplates(): Note[] {
	const initializationStatus = useStorageStore((s) => s.initializationStatus);
	const initializationError = useStorageStore((s) => s.initializationError);
	const contentVersion = useStorageStore((s) => s.contentVersion);

	if (initializationStatus === "pending") {
		throw waitForStorageReady();
	}

	if (initializationStatus === "failed") {
		throw new Error(initializationError ?? "Storage is unavailable");
	}

	const key = buildTemplatesQueryKey({ contentVersion, refreshVersion: 0 });
	return use(getCachedQueryPromise(key, loadTemplates));
}
