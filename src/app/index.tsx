import HomeQuickComposer from "@/components/HomeQuickComposer";
import HomeScreenHeader from "@/components/HomeScreenHeader";
import NoteGrid from "@/components/NoteGrid";
import { TabBar } from "@/components/TabBar";
import AddNoteToClusterModal from "@/components/moc/AddNoteToClusterModal";
import RenameClusterModal from "@/components/moc/RenameClusterModal";
import ErrorScreen from "@/components/shared/ErrorScreen";
import QueryErrorBoundary from "@/components/shared/QueryErrorBoundary";
import { useAppKeyboardShortcuts } from "@/hooks/useAppKeyboardShortcuts";
import { useCreateAndOpenNote } from "@/hooks/useCreateAndOpenNote";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import useNotes from "@/hooks/useNotes";
import { useStartupReady } from "@/hooks/useStartupReady";
import { useStyles } from "@/hooks/useStyles";
import { logFeedback } from "@/services/notes/clusterFeedbackService";
import {
	clusterAddNote,
	clusterDelete,
	clusterRemoveNote,
	clusterRename,
} from "@/services/notes/clusterService";
import type { NoteSection } from "@/services/notes/indexDb/types";
import { invalidateNoteQueryCache } from "@/services/notes/noteQueryCache";
import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { showToast } from "@/services/toast";
import { useStorageStore } from "@/stores/storageStore";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import type { ParamListBase } from "@react-navigation/native";
import { router, useNavigation } from "expo-router";
import { nanoid } from "nanoid";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
	Alert,
	Platform,
	StyleSheet,
	type TextInput,
	View,
} from "react-native";

function IndexContent() {
	const {
		notes,
		sections,
		query,
		hasMore,
		isRefreshing,
		isLoadingMore,
		error,
		handleRefresh,
		loadMoreNotes,
		setQuery,
	} = useNotes();
	const bumpContentVersion = useStorageStore((s) => s.bumpContentVersion);
	const [renameTarget, setRenameTarget] = useState<NoteSection | null>(null);
	const [addNoteTarget, setAddNoteTarget] = useState<NoteSection | null>(null);
	const createAndOpenNote = useCreateAndOpenNote();
	const markStartupReady = useStartupReady();
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
		[handleRefresh],
	);

	const handleCreateQuickNote = useCallback(
		async (draft: {
			title: string;
			content: string;
			isPinned: boolean;
		}) => {
			try {
				await NoteService.saveNote(
					{
						id: nanoid(),
						title: draft.title,
						content: draft.content,
						isPinned: draft.isPinned,
						noteType: "note",
					},
					true,
				);
				invalidateNoteQueryCache();
				bumpContentVersion();
				await handleRefresh();
			} catch (error) {
				console.warn("Failed to create note:", error);
				showToast("Failed to create note");
				throw error;
			}
		},
		[bumpContentVersion, handleRefresh],
	);

	const handlePinToggle = useCallback(
		async (updated: Note) => {
			await NoteService.saveNote(updated);
			await handleRefresh();
		},
		[handleRefresh],
	);

	const handleRemoveNote = useCallback(
		async (clusterId: string, noteId: string) => {
			await clusterRemoveNote(clusterId, noteId);
			logFeedback(clusterId, "remove_note", { noteId }).catch(() => {});
			bumpContentVersion();
			await handleRefresh();
		},
		[bumpContentVersion, handleRefresh],
	);

	const handleRenameConfirm = useCallback(
		async (newName: string) => {
			if (!renameTarget?.clusterId) return;
			await clusterRename(renameTarget.clusterId, newName);
			logFeedback(renameTarget.clusterId, "rename", {
				originalName: renameTarget.title,
				newName,
			}).catch(() => {});
			setRenameTarget(null);
			bumpContentVersion();
			await handleRefresh();
		},
		[renameTarget, bumpContentVersion, handleRefresh],
	);

	const handleAddNoteConfirm = useCallback(
		async (noteId: string) => {
			if (!addNoteTarget?.clusterId) return;
			await clusterAddNote(addNoteTarget.clusterId, noteId);
			logFeedback(addNoteTarget.clusterId, "add_note", { noteId }).catch(
				() => {},
			);
			setAddNoteTarget(null);
			bumpContentVersion();
			await handleRefresh();
		},
		[addNoteTarget, bumpContentVersion, handleRefresh],
	);

	const handleDeleteCluster = useCallback(
		(section: NoteSection) => {
			const clusterId = section.clusterId;
			if (!clusterId) return;
			const confirmDelete = async () => {
				await clusterDelete(clusterId);
				logFeedback(clusterId, "delete", {
					clusterName: section.title,
				}).catch(() => {});
				bumpContentVersion();
				await handleRefresh();
			};
			if (Platform.OS === "web") {
				if (
					window.confirm(`Delete "${section.title}"? This cannot be undone.`)
				) {
					void confirmDelete();
				}
			} else {
				Alert.alert(
					"Delete Cluster",
					`Delete "${section.title}"? This cannot be undone.`,
					[
						{ text: "Cancel", style: "cancel" },
						{ text: "Delete", style: "destructive", onPress: confirmDelete },
					],
				);
			}
		},
		[bumpContentVersion, handleRefresh],
	);

	const safeSections = sections ?? [];

	const enhancedSections = useMemo(
		() =>
			safeSections.map((section) => {
				if (!section.clusterId) return section;
				const clusterId = section.clusterId;
				return {
					...section,
					clusterId,
					clusterActions: {
						onRename: () => setRenameTarget(section),
						onAddNote: () => setAddNoteTarget(section),
						onDelete: () => handleDeleteCluster(section),
						onRemoveNote: (noteId: string) =>
							void handleRemoveNote(clusterId, noteId),
					},
				};
			}),
		[safeSections, handleDeleteCluster, handleRemoveNote],
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

	return (
		<View style={styles.container}>
			<TabBar activeView="home" />
			<HomeScreenHeader
				searchQuery={query}
				setSearchQuery={setQuery}
				searchInputRef={searchInputRef}
				onMenuPress={handleMenuPress}
				onOpenSuggestedMocs={() => router.push("/suggested-mocs")}
			/>
			<NoteGrid
				notes={notes ?? []}
				sections={enhancedSections}
				emptySubtitle={emptySubtitle}
				onDelete={handleDeleteNote}
				onPinToggle={handlePinToggle}
				refreshing={isRefreshing}
				onRefresh={handleRefresh}
				onEndReached={loadMoreNotes}
				isLoadingMore={isLoadingMore}
				hasMore={hasMore}
				listHeaderComponent={
					<HomeQuickComposer
						onCreateTypedNote={createAndOpenNote}
						onSave={handleCreateQuickNote}
					/>
				}
				onReady={markStartupReady}
			/>
			<RenameClusterModal
				visible={renameTarget !== null}
				initialName={renameTarget?.title ?? ""}
				onClose={() => setRenameTarget(null)}
				onConfirm={handleRenameConfirm}
			/>
			<AddNoteToClusterModal
				visible={addNoteTarget !== null}
				onClose={() => setAddNoteTarget(null)}
				onConfirm={handleAddNoteConfirm}
				excludeNoteIds={
					addNoteTarget?.memberNoteIds ??
					addNoteTarget?.notes.map((note) => note.id) ??
					[]
				}
			/>
			{error ? (
				<ErrorScreen error={new Error(error)} onRetry={handleRefresh} />
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
					error={error}
					onRetry={() => {
						invalidateNoteQueryCache();
						reset();
						setRetryVersion((current) => current + 1);
					}}
				/>
			)}
		>
			<IndexContent key={retryVersion} />
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
