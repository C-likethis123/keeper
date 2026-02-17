import ErrorScreen from "@/components/ErrorScreen";
import Loader from "@/components/Loader";
import NoteGrid from "@/components/NoteGrid";
import { SearchBar } from "@/components/SearchBar";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import useNotes from "@/hooks/useNotes";
import type { Note } from "@/services/notes/types";
import { useNotesMetaStore } from "@/stores/notes/metaStore";
import { useNoteStore } from "@/stores/notes/noteStore";
import { useToastStore } from "@/stores/toastStore";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

export default function Index() {
	const {
		notes,
		setNotes,
		query,
		hasMore,
		isLoading,
		error,
		handleRefresh,
		loadMoreNotes,
		setQuery,
	} = useNotes();
	const theme = useExtendedTheme();
	const { showToast } = useToastStore();
	const { deleteNote } = useNoteStore();
	const { setPinned } = useNotesMetaStore();

	const handleDeleteNote = useCallback(
		async (note: Note) => {
			try {
				await deleteNote(note.filePath);
				setNotes((prev: Note[]) =>
					prev.filter((n: Note) => n.filePath !== note.filePath),
				);
				showToast(`Deleted "${note.title}"`);
			} catch (e) {
				console.warn("Failed to delete note:", e);
				showToast("Failed to delete note");
			}
		},
		[deleteNote, showToast],
	);

	const handlePinToggle = useCallback((updated: Note) => {
		setNotes((prev) =>
			prev.map((n) => (n.filePath === updated.filePath ? updated : n)),
		);
		setPinned(updated.filePath, updated.isPinned ?? false);
	}, [setPinned]);

	const styles = useMemo(() => createStyles(theme), [theme]);

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
			<SearchBar searchQuery={query} setSearchQuery={setQuery} />
			<NoteGrid
				notes={notes}
				onDelete={handleDeleteNote}
				onPinToggle={handlePinToggle}
				refreshing={isLoading}
				onRefresh={handleRefresh}
				onEndReached={loadMoreNotes}
				isLoadingMore={isLoading}
				hasMore={hasMore}
			/>
			<TouchableOpacity
				activeOpacity={0.8}
				style={styles.fab}
				onPress={() => router.push("/editor")}
			>
				<MaterialIcons name="add" size={28} color={theme.colors.card} />
			</TouchableOpacity>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: theme.colors.background,
		},
		fab: {
			position: "absolute",
			right: 24,
			bottom: 24,
			width: 56,
			height: 56,
			borderRadius: 28,
			backgroundColor: theme.colors.primary,
			alignItems: "center",
			justifyContent: "center",
			elevation: 4, // Android
			shadowColor: "#000", // iOS
			shadowOpacity: 0.2,
			shadowRadius: 4,
			shadowOffset: { width: 0, height: 2 },
		},
	});
}
