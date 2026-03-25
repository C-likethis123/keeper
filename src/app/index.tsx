import HomeQuickComposer from "@/components/HomeQuickComposer";
import HomeScreenHeader from "@/components/HomeScreenHeader";
import ErrorScreen from "@/components/shared/ErrorScreen";
import Loader from "@/components/shared/Loader";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import useNotes from "@/hooks/useNotes";
import { useStyles } from "@/hooks/useStyles";
import { appEvents } from "@/services/appEvents";
import { NoteService } from "@/services/notes/noteService";
import type { Note, NoteType } from "@/services/notes/types";
import { useStorageStore } from "@/stores/storageStore";
import { useToastStore } from "@/stores/toastStore";
import { Stack, router, useFocusEffect } from "expo-router";
import { nanoid } from "nanoid";
import React, { useCallback, useEffect, useRef } from "react";
import {
	Alert,
	Platform,
	StyleSheet,
	type TextInput,
	View,
} from "react-native";

const LazyNoteGrid = React.lazy(() => import("@/components/NoteGrid"));

export default function Index() {
	const {
		notes,
		query,
		noteTypeFilter,
		statusFilter,
		hasMore,
		isLoading,
		error,
		handleRefresh,
		loadMoreNotes,
		setQuery,
		setNoteTypeFilter,
		setStatusFilter,
	} = useNotes();
	const theme = useExtendedTheme();
	const showToast = useToastStore((state) => state.showToast);
	const canSearch = useStorageStore((s) => s.capabilities.canSearch);
	const [isResetting, setIsResetting] = React.useState(false);

	const handleDeleteNote = useCallback(
		async (note: Note) => {
			try {
				const success = await NoteService.deleteNote(note.id);
				if (!success) throw new Error("Failed to delete note");
				showToast(`Deleted "${note.title}"`);
			} catch (e) {
				console.warn("Failed to delete note:", e);
				showToast("Failed to delete note");
			}
		},
		[showToast],
	);

	const runReset = useCallback(async () => {
		if (isResetting) {
			return;
		}
		setIsResetting(true);
		showToast("Clearing app data...", 1500);
		try {
			const { resetAppData } = await import(
				"@/services/app/resetAppDataService"
			);
			await resetAppData();
			await handleRefresh();
			showToast("App data cleared");
		} catch (error) {
			console.warn("Failed to reset app data:", error);
			showToast(
				error instanceof Error ? error.message : "Failed to clear app data",
				6000,
			);
		} finally {
			setIsResetting(false);
		}
	}, [handleRefresh, isResetting, showToast]);

	// REVIEW: this is different from web...
	const confirmReset = useCallback(() => {
		if (isResetting) {
			return;
		}
		const title = "Reset app data?";
		const message =
			"This clears local notes, attachments, search data, and stored app keys. Git-backed notes may sync back from remote afterward.";
		if (Platform.OS === "web") {
			void runReset();
			return;
		}
		Alert.alert(title, message, [
			{
				text: "Cancel",
				style: "cancel",
			},
			{
				text: "Reset",
				style: "destructive",
				onPress: () => {
					void runReset();
				},
			},
		]);
	}, [isResetting, runReset]);

	const handlePinToggle = useCallback(async (updated: Note) => {
		await NoteService.saveNote(updated);
	}, []);

	const handleCreateNote = useCallback(async () => {
		const newNote = {
			id: nanoid(),
			title: "",
			content: "",
			lastUpdated: Date.now(),
			isPinned: false,
			noteType: "note" as NoteType,
		};
		await NoteService.saveNote(newNote, true);
		router.push(`/editor?id=${newNote.id}`);
	}, []);

	const handleCreateTypedNote = useCallback(
		async (noteType: Extract<NoteType, "journal" | "resource">) => {
			const newNote = {
				id: nanoid(),
				title: "",
				content: "",
				lastUpdated: Date.now(),
				isPinned: false,
				noteType,
			};
			await NoteService.saveNote(newNote, true);
			router.push(`/editor?id=${newNote.id}`);
		},
		[],
	);

	const handleCreateTodo = useCallback(async () => {
		const newTodo = {
			id: nanoid(),
			title: "",
			content: "",
			lastUpdated: Date.now(),
			isPinned: false,
			noteType: "todo" as NoteType,
			status: "open" as const,
		};
		await NoteService.saveNote(newTodo, true);
		router.push(`/editor?id=${newTodo.id}`);
	}, []);

	const searchInputRef = useRef<TextInput>(null);

	useEffect(() => {
		return appEvents.on("focusSearch", () => {
			searchInputRef.current?.focus();
		});
	}, []);

	const styles = useStyles(createStyles);
	const emptySubtitle =
		"There are no notes that match existing filters. Create a note to get started";

	useFocusEffect(
		useCallback(() => {
			handleRefresh();
		}, [handleRefresh]),
	);

	if (isLoading && notes.length === 0) {
		return <Loader />;
	}

	if (error) {
		return <ErrorScreen errorMessage={error} onRetry={handleRefresh} />;
	}

	return (
		<View style={styles.container}>
			<Stack.Screen
				options={{
					header: (options) => (
						<HomeScreenHeader
							searchQuery={query}
							setSearchQuery={setQuery}
							searchEditable={canSearch}
							searchInputRef={searchInputRef}
							noteTypes={noteTypeFilter}
							status={statusFilter}
							onNoteTypesChange={(values) => {
								setNoteTypeFilter(values);
								if (!values.includes("todo")) {
									setStatusFilter(undefined);
								}
							}}
							onStatusChange={setStatusFilter}
							onReset={confirmReset}
							resetDisabled={isResetting}
						/>
					),
				}}
			/>
			<React.Suspense fallback={<Loader />}>
				<LazyNoteGrid
					notes={notes}
					emptySubtitle={emptySubtitle}
					onDelete={handleDeleteNote}
					onPinToggle={handlePinToggle}
					refreshing={isLoading}
					onRefresh={handleRefresh}
					onEndReached={loadMoreNotes}
					isLoadingMore={isLoading}
					hasMore={hasMore}
					listHeaderComponent={
						<HomeQuickComposer
							onPress={() => {
								void handleCreateNote();
							}}
							onCreateTodo={() => {
								void handleCreateTodo();
							}}
							onCreateJournal={() => {
								void handleCreateTypedNote("journal");
							}}
							onCreateResource={() => {
								void handleCreateTypedNote("resource");
							}}
						/>
					}
				/>
			</React.Suspense>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: theme.colors.background,
		},
	});
}
