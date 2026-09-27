import HomeQuickComposer from "@/components/HomeQuickComposer";
import HomeScreenHeader from "@/components/HomeScreenHeader";
import NoteGrid from "@/components/NoteGrid";
import ErrorScreen from "@/components/shared/ErrorScreen";
import Loader from "@/components/shared/Loader";
import { NOTE_GRID_PAGE_SIZE } from "@/constants/pagination";
import { useAppKeyboardShortcuts } from "@/hooks/useAppKeyboardShortcuts";
import type { Note, NoteType } from "@/services/notes/types";
import { useFilterStore } from "@/stores/filterStore";
import { useTabStore } from "@/stores/tabStore";
import { useBrowserNotes } from "@web/state/BrowserNotesProvider";
import { useOpenBrowserDrawer } from "@web/shell/ViteAppShell";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Pressable,
	StyleSheet,
	Text,
	type TextInput,
	View,
} from "react-native";
import { useNavigate } from "react-router-dom";

function compareNotes(left: Note, right: Note) {
	if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
	return right.lastUpdated - left.lastUpdated;
}

export function HomeRoute() {
	const {
		notes,
		ready,
		loadError,
		createNote,
		deleteNote,
		saveNote,
		reloadNotes,
	} = useBrowserNotes();
	const navigate = useNavigate();
	const openDrawer = useOpenBrowserDrawer();
	const [query, setQuery] = useState("");
	const [visibleLimit, setVisibleLimit] = useState(NOTE_GRID_PAGE_SIZE);
	const [refreshing, setRefreshing] = useState(false);
	const paginationPending = useRef(false);
	const searchInputRef = useRef<TextInput>(null);
	const noteTypes = useFilterStore((state) => state.noteTypes);
	const status = useFilterStore((state) => state.status);
	const hideDone = useFilterStore((state) => state.hideDone);
	const resetFilters = useFilterStore((state) => state.reset);

	const filteredNotes = useMemo(() => {
		const term = query.trim().toLocaleLowerCase();
		return notes
			.filter((note) => {
				if (
					term &&
					!`${note.title}\n${note.content}`.toLocaleLowerCase().includes(term)
				) {
					return false;
				}
				if (noteTypes.length > 0 && !noteTypes.includes(note.noteType))
					return false;
				if (status && note.status !== status) return false;
				if (hideDone && note.noteType === "todo" && note.status === "done")
					return false;
				return true;
			})
			.sort(compareNotes);
	}, [hideDone, noteTypes, notes, query, status]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Filter changes restart canonical paging.
	useEffect(() => {
		setVisibleLimit(NOTE_GRID_PAGE_SIZE);
	}, [hideDone, noteTypes, notes, query, status]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: A committed page releases the request gate.
	useEffect(() => {
		paginationPending.current = false;
	}, [visibleLimit]);

	const openNote = useCallback(
		(note: Note) => {
			useTabStore.getState().openTab(note.id, note.title);
			navigate(`/editor/${note.id}`);
		},
		[navigate],
	);

	const createAndOpenNote = useCallback(
		(options?: { noteType?: NoteType; title?: string }) => {
			const note = createNote(options?.noteType, options?.title);
			useTabStore.getState().openTab(note.id, note.title, true);
			navigate(`/editor/${note.id}`);
		},
		[createNote, navigate],
	);

	const createQuickNote = useCallback(
		async (draft: { title: string; content: string; isPinned: boolean }) => {
			const note = createNote("note", draft.title, {
				content: draft.content,
				isPinned: draft.isPinned,
			});
			useTabStore.getState().openTab(note.id, note.title, true);
			navigate(`/editor/${note.id}`);
		},
		[createNote, navigate],
	);

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await reloadNotes();
		} finally {
			setRefreshing(false);
		}
	}, [reloadNotes]);

	const loadMore = useCallback(() => {
		if (paginationPending.current || visibleLimit >= filteredNotes.length)
			return;
		paginationPending.current = true;
		setVisibleLimit((current) =>
			Math.min(current + NOTE_GRID_PAGE_SIZE, filteredNotes.length),
		);
	}, [filteredNotes.length, visibleLimit]);

	const reset = useCallback(() => {
		setQuery("");
		resetFilters();
	}, [resetFilters]);

	useAppKeyboardShortcuts({
		onFocusSearch: () => searchInputRef.current?.focus(),
		onCreateNote: () => createAndOpenNote(),
	});

	const hasActiveFilters =
		query.trim().length > 0 ||
		noteTypes.length > 0 ||
		status != null ||
		hideDone;

	return (
		<main className="home-route" aria-label="Notes">
			<HomeScreenHeader
				searchQuery={query}
				setSearchQuery={setQuery}
				searchInputRef={searchInputRef}
				onMenuPress={openDrawer}
				onOpenSuggestedMocs={() => navigate("/suggested-mocs")}
			/>
			{hasActiveFilters ? (
				<View style={styles.activeFilters} accessibilityRole="summary">
					<Text style={styles.activeFilterText}>
						{[
							query && `Search: ${query}`,
							noteTypes.join(", "),
							status,
							hideDone && "Hide done",
						]
							.filter(Boolean)
							.join(" · ")}
					</Text>
					<Pressable
						accessibilityRole="button"
						onPress={reset}
						style={styles.resetButton}
					>
						<Text style={styles.resetText}>Reset filters</Text>
					</Pressable>
				</View>
			) : null}
			{!ready ? (
				<Loader />
			) : loadError ? (
				<ErrorScreen error={loadError} onRetry={() => void reloadNotes()} />
			) : (
				<NoteGrid
					notes={filteredNotes.slice(0, visibleLimit)}
					onOpen={openNote}
					onDelete={(note) => void deleteNote(note.id)}
					onPinToggle={(note) => {
						const original = notes.find((item) => item.id === note.id);
						if (original)
							void saveNote({ ...original, isPinned: note.isPinned });
					}}
					refreshing={refreshing}
					onRefresh={() => void handleRefresh()}
					onEndReached={loadMore}
					isLoadingMore={paginationPending.current}
					hasMore={visibleLimit < filteredNotes.length}
					listHeaderComponent={
						<HomeQuickComposer
							onCreateTypedNote={createAndOpenNote}
							onSave={createQuickNote}
						/>
					}
				/>
			)}
		</main>
	);
}

const styles = StyleSheet.create({
	activeFilters: {
		minHeight: 44,
		paddingHorizontal: 16,
		paddingVertical: 8,
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	activeFilterText: { flex: 1, color: "#aaa9ae", fontSize: 13 },
	resetButton: { paddingHorizontal: 10, paddingVertical: 6 },
	resetText: { color: "#9ece6a", fontWeight: "600" },
});
