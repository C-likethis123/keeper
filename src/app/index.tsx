import HomeQuickComposer from "@/components/HomeQuickComposer";
import HomeScreenHeader from "@/components/HomeScreenHeader";
import ResetAppDataModal from "@/components/ResetAppDataModal";
import ErrorScreen from "@/components/shared/ErrorScreen";
import Loader from "@/components/shared/Loader";
import QueryErrorBoundary from "@/components/shared/QueryErrorBoundary";
import { useAppKeyboardShortcuts } from "@/hooks/useAppKeyboardShortcuts";
import { useCreateAndOpenNote } from "@/hooks/useCreateAndOpenNote";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import useNotes from "@/hooks/useNotes";
import { useStyles } from "@/hooks/useStyles";
import { invalidateNoteQueryCache } from "@/services/notes/noteQueryCache";
import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { useFilterStore } from "@/stores/filterStore";
import { useToastStore } from "@/stores/toastStore";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import type { ParamListBase } from "@react-navigation/native";
import { useFocusEffect, useNavigation } from "expo-router";
import React, { Suspense, useCallback, useRef, useState } from "react";
import { StyleSheet, type TextInput, View } from "react-native";

const LazyNoteGrid = React.lazy(() => import("@/components/NoteGrid"));

function IndexContent() {
	const {
		notes,
		sections,
		query,
		hasMore,
		isLoading,
		error,
		handleRefresh,
		loadMoreNotes,
		setQuery,
	} = useNotes();
	const reset = useFilterStore((s) => s.reset);
	const showToast = useToastStore((state) => state.showToast);
	const [isResetting, setIsResetting] = React.useState(false);
	const [isResetModalVisible, setIsResetModalVisible] = useState(false);
	const createAndOpenNote = useCreateAndOpenNote();
	const navigation = useNavigation<DrawerNavigationProp<ParamListBase>>();

	const handleMenuPress = useCallback(() => {
		navigation.openDrawer();
	}, [navigation]);

	const handleDeleteNote = useCallback(
		async (note: Note) => {
			try {
				const success = await NoteService.deleteNote(note.id);
				if (!success) throw new Error("Failed to delete note");
				showToast(`Deleted "${note.title}"`);
				await handleRefresh();
			} catch (e) {
				console.warn("Failed to delete note:", e);
				showToast("Failed to delete note");
			}
		},
		[showToast, handleRefresh],
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

	const confirmReset = useCallback(() => {
		if (isResetting) {
			return;
		}
		setIsResetModalVisible(true);
	}, [isResetting]);

	const closeResetModal = useCallback(() => {
		if (isResetting) {
			return;
		}
		setIsResetModalVisible(false);
	}, [isResetting]);

	const handleConfirmReset = useCallback(() => {
		setIsResetModalVisible(false);
		void runReset();
		reset();
	}, [runReset, reset]);

	const handlePinToggle = useCallback(
		async (updated: Note) => {
			await NoteService.saveNote(updated);
			await handleRefresh();
		},
		[handleRefresh],
	);

	const searchInputRef = useRef<TextInput>(null);
	useAppKeyboardShortcuts({
		onFocusSearch: () => {
			searchInputRef.current?.focus();
		},
		onCreateNote: () => {
			void createAndOpenNote();
		},
	});

	const styles = useStyles(createStyles);
	const emptySubtitle =
		"There are no notes that match existing filters. Create a note to get started";

	useFocusEffect(
		useCallback(() => {
			void handleRefresh();
		}, [handleRefresh]),
	);

	return (
		<View style={styles.container}>
			<HomeScreenHeader
				searchQuery={query}
				setSearchQuery={setQuery}
				searchInputRef={searchInputRef}
				onMenuPress={handleMenuPress}
				onReset={confirmReset}
				resetDisabled={isResetting}
			/>
			<Suspense fallback={<Loader />}>
				<LazyNoteGrid
					notes={notes}
					sections={sections}
					emptySubtitle={emptySubtitle}
					onDelete={handleDeleteNote}
					onPinToggle={handlePinToggle}
					refreshing={isLoading}
					onRefresh={handleRefresh}
					onEndReached={loadMoreNotes}
					isLoadingMore={isLoading}
					hasMore={hasMore}
					listHeaderComponent={
						<HomeQuickComposer onPress={createAndOpenNote} />
					}
				/>
			</Suspense>
			<ResetAppDataModal
				visible={isResetModalVisible}
				isResetting={isResetting}
				onClose={closeResetModal}
				onConfirm={handleConfirmReset}
			/>
			{error ? (
				<ErrorScreen errorMessage={error} onRetry={handleRefresh} />
			) : null}
		</View>
	);
}

export default function Index() {
	const [retryVersion, setRetryVersion] = useState(0);

	return (
		<QueryErrorBoundary
			fallbackRender={(error, reset) => (
				<ErrorScreen
					errorMessage={error.message}
					onRetry={() => {
						invalidateNoteQueryCache();
						reset();
						setRetryVersion((current) => current + 1);
					}}
				/>
			)}
		>
			<Suspense fallback={<Loader />}>
				<IndexContent key={retryVersion} />
			</Suspense>
		</QueryErrorBoundary>
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
