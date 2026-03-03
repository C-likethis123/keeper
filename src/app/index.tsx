import NoteGrid from "@/components/NoteGrid";
import ErrorScreen from "@/components/shared/ErrorScreen";
import Loader from "@/components/shared/Loader";
import { SearchBar } from "@/components/shared/SearchBar";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import useNotes from "@/hooks/useNotes";
import { useStyles } from "@/hooks/useStyles";
import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { useToastStore } from "@/stores/toastStore";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { nanoid } from "nanoid";
import React, { useCallback } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

export default function Index() {
	const {
		notes,
		query,
		hasMore,
		isLoading,
		error,
		handleRefresh,
		loadMoreNotes,
		setQuery,
	} = useNotes();
	const theme = useExtendedTheme();
	const showToast = useToastStore((state) => state.showToast);

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

	const handlePinToggle = useCallback(async (updated: Note) => {
		await NoteService.saveNote(updated);
	}, []);

	const styles = useStyles(createStyles);

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
				onPress={async () => {
					const newNote = {
						id: nanoid(),
						title: "",
						content: "",
						lastUpdated: Date.now(),
						isPinned: false,
					};
					await NoteService.saveNote(newNote, true);
					router.push(`/editor?id=${newNote.id}`);
				}}
			>
				<MaterialIcons
					name="add"
					size={28}
					color={theme.colors.primaryContrast}
				/>
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
			shadowColor: theme.colors.shadow,
			shadowOpacity: 0.2,
			shadowRadius: 4,
			shadowOffset: { width: 0, height: 2 },
		},
	});
}
