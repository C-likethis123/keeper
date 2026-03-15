import NoteGrid from "@/components/NoteGrid";
import ErrorScreen from "@/components/shared/ErrorScreen";
import Loader from "@/components/shared/Loader";
import { SearchBar } from "@/components/shared/SearchBar";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import useNotes from "@/hooks/useNotes";
import { useStyles } from "@/hooks/useStyles";
import { resetAppData } from "@/services/app/resetAppDataService";
import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { useStorageStore } from "@/stores/storageStore";
import { useToastStore } from "@/stores/toastStore";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, router, useFocusEffect } from "expo-router";
import { nanoid } from "nanoid";
import React, { useCallback } from "react";
import {
	Alert,
	Platform,
	StyleSheet,
	TouchableOpacity,
	View,
} from "react-native";

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
	const capabilities = useStorageStore((s) => s.capabilities);
	const [isResetting, setIsResetting] = React.useState(false);

	const handleDeleteNote = useCallback(
		async (note: Note) => {
			if (!capabilities.canWrite) {
				showToast(capabilities.reason ?? "Read-only mode");
				return;
			}
			try {
				const success = await NoteService.deleteNote(note.id);
				if (!success) throw new Error("Failed to delete note");
				showToast(`Deleted "${note.title}"`);
			} catch (e) {
				console.warn("Failed to delete note:", e);
				showToast("Failed to delete note");
			}
		},
		[showToast, capabilities.canWrite, capabilities.reason],
	);

	const runReset = useCallback(async () => {
		if (isResetting) {
			return;
		}
		setIsResetting(true);
		showToast("Clearing app data...", 1500);
		try {
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
		Alert.alert(
			title,
			message,
			[
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
			],
		);
	}, [isResetting, runReset]);

	const handlePinToggle = useCallback(async (updated: Note) => {
		if (!capabilities.canWrite) {
			showToast(capabilities.reason ?? "Read-only mode");
			return;
		}
		await NoteService.saveNote(updated);
	}, [capabilities.canWrite, capabilities.reason, showToast]);

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
			<Stack.Screen
				options={{
					title: "Keeper",
					headerRight: () => (
						<TouchableOpacity
							onPress={confirmReset}
							disabled={isResetting}
							style={styles.headerAction}
						>
							<MaterialIcons
								name="delete-forever"
								size={22}
								color={
									isResetting
										? theme.colors.textFaded
										: theme.colors.error
								}
							/>
						</TouchableOpacity>
					),
				}}
			/>
			<SearchBar
				searchQuery={query}
				setSearchQuery={setQuery}
				editable={capabilities.canSearch}
			/>
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
				style={[
					styles.fab,
					!capabilities.canWrite && { opacity: 0.5 },
				]}
				onPress={async () => {
					if (!capabilities.canWrite) {
						showToast(capabilities.reason ?? "Read-only mode");
						return;
					}
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
				disabled={!capabilities.canWrite}
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
		headerAction: {
			paddingHorizontal: 8,
			paddingVertical: 4,
		},
	});
}
