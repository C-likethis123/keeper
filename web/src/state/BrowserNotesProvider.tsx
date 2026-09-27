import { invalidateNoteQueryCache } from "@/services/notes/noteQueryCache";
import type { NoteType } from "@/services/notes/types";
import { useStorageStore } from "@/stores/storageStore";
import { useToastStore } from "@/stores/toastStore";
import {
	captureBrowserNoteVersion,
	deleteBrowserNoteVersions,
} from "@web/services/noteHistory";
import {
	enqueueBrowserNoteDelete,
	enqueueBrowserNoteSave,
	startBrowserSync,
	syncBrowserNotes,
} from "@web/services/noteSync";
import {
	BROWSER_NOTES_CHANGED,
	loadBrowserNotes,
	persistBrowserNotes,
	type BrowserNote,
} from "@web/ui/noteRepository";
import { isSyncAuthRequiredError } from "@keeper/services/sync/syncRequestError";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export type BrowserNotesContextValue = {
	notes: BrowserNote[];
	ready: boolean;
	loadError: Error | null;
	createNote(
		noteType?: NoteType,
		title?: string,
		initial?: { content?: string; isPinned?: boolean },
	): BrowserNote;
	saveNote(note: BrowserNote): Promise<void>;
	deleteNote(id: string): Promise<void>;
	reloadNotes(): Promise<void>;
	notify(message: string): void;
};

const BrowserNotesContext = createContext<BrowserNotesContextValue | null>(
	null,
);

function changedNote(previous: BrowserNote, next: BrowserNote) {
	return (
		previous.title !== next.title ||
		previous.content !== next.content ||
		previous.noteType !== next.noteType ||
		previous.isPinned !== next.isPinned ||
		previous.attachment !== next.attachment ||
		previous.attachedVideo !== next.attachedVideo ||
		previous.resourceUrl !== next.resourceUrl ||
		previous.status !== next.status
	);
}

function sortNotes(notes: BrowserNote[]) {
	return [...notes].sort((left, right) => right.lastUpdated - left.lastUpdated);
}

export function useBrowserNotes() {
	const value = useContext(BrowserNotesContext);
	if (!value) throw new Error("Missing Vite notes provider");
	return value;
}

export function BrowserNotesProvider({
	children,
	loadNotes = loadBrowserNotes,
}: {
	children: ReactNode;
	loadNotes?: () => Promise<BrowserNote[]>;
}) {
	const [notes, setNotes] = useState<BrowserNote[]>([]);
	const notesRef = useRef<BrowserNote[]>([]);
	const [ready, setReady] = useState(false);
	const [loadError, setLoadError] = useState<Error | null>(null);
	const bumpContentVersion = useStorageStore(
		(state) => state.bumpContentVersion,
	);
	const showToast = useToastStore((state) => state.showToast);

	const replaceNotes = useCallback((next: BrowserNote[]) => {
		const sorted = sortNotes(next);
		notesRef.current = sorted;
		setNotes(sorted);
	}, []);

	const reloadNotes = useCallback(async () => {
		setReady(false);
		setLoadError(null);
		try {
			replaceNotes(await loadNotes());
		} catch (error) {
			setLoadError(
				error instanceof Error ? error : new Error("Failed to load notes"),
			);
		} finally {
			setReady(true);
		}
	}, [loadNotes, replaceNotes]);

	useEffect(() => {
		void reloadNotes();
	}, [reloadNotes]);

	useEffect(() => {
		const receiveNotes = (event: Event) => {
			const next = (event as CustomEvent<BrowserNote[]>).detail;
			if (Array.isArray(next)) replaceNotes(next);
		};
		window.addEventListener(BROWSER_NOTES_CHANGED, receiveNotes);
		return () =>
			window.removeEventListener(BROWSER_NOTES_CHANGED, receiveNotes);
	}, [replaceNotes]);

	useEffect(() => {
		if (!ready || loadError) return;
		return startBrowserSync({
			onNotes: replaceNotes,
			onError: (error) => {
				console.warn("[BrowserSync] Sync failed:", error);
				showToast(
					isSyncAuthRequiredError(error)
						? "Sign in through Cloudflare Access to resume sync."
						: "Remote sync failed. Local changes remain saved.",
				);
			},
		});
	}, [loadError, ready, replaceNotes, showToast]);

	const commit = useCallback(
		async (next: BrowserNote[], message: string) => {
			const previousNotes = notesRef.current;
			const previous = new Map(previousNotes.map((note) => [note.id, note]));
			const versions = next.flatMap((note) => {
				const old = previous.get(note.id);
				return old && changedNote(old, note) ? [old] : [];
			});
			replaceNotes(next);
			await Promise.all(versions.map(captureBrowserNoteVersion));
			await persistBrowserNotes(next);
			await Promise.all(
				next.flatMap((note) => {
					const old = previous.get(note.id);
					return !old || changedNote(old, note)
						? [enqueueBrowserNoteSave(note, !old)]
						: [];
				}),
			);
			await Promise.all(
				previousNotes
					.filter((note) => !next.some((item) => item.id === note.id))
					.map((note) => enqueueBrowserNoteDelete(note.id)),
			);
			invalidateNoteQueryCache();
			bumpContentVersion();
			void syncBrowserNotes()
				.then(replaceNotes)
				.catch((error) => {
					console.warn("[BrowserSync] Save sync failed:", error);
					showToast(
						isSyncAuthRequiredError(error)
							? "Sign in through Cloudflare Access to resume sync."
							: "Remote sync failed. Local changes remain saved.",
					);
				});
			showToast(message);
		},
		[bumpContentVersion, replaceNotes, showToast],
	);

	const value = useMemo<BrowserNotesContextValue>(
		() => ({
			notes,
			ready,
			loadError,
			createNote: (noteType = "note", title = "", initial = {}) => {
				const timestamp = Date.now();
				const note: BrowserNote = {
					id: crypto.randomUUID(),
					title,
					content: initial.content ?? "",
					noteType,
					isPinned: initial.isPinned ?? false,
					lastUpdated: timestamp,
					modified: timestamp,
					status: noteType === "todo" ? "open" : null,
					createdAt: timestamp,
					completedAt: null,
					attachment: null,
					attachedVideo: null,
					resourceUrl: null,
					documentPositions: null,
				};
				void commit([note, ...notesRef.current], "Note created locally");
				return note;
			},
			saveNote: (note) =>
				commit(
					[note, ...notesRef.current.filter((item) => item.id !== note.id)],
					"Saved locally",
				),
			deleteNote: async (id) => {
				await commit(
					notesRef.current.filter((note) => note.id !== id),
					"Deleted locally",
				);
				await deleteBrowserNoteVersions(id);
			},
			reloadNotes,
			notify: showToast,
		}),
		[commit, loadError, notes, ready, reloadNotes, showToast],
	);

	return (
		<BrowserNotesContext.Provider value={value}>
			{children}
		</BrowserNotesContext.Provider>
	);
}
