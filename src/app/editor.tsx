import NoteEditorView from "@/components/NoteEditorView";
import { TabBar } from "@/components/TabBar";
import ErrorScreen from "@/components/shared/ErrorScreen";
import Loader from "@/components/shared/Loader";
import QueryErrorBoundary from "@/components/shared/QueryErrorBoundary";
import { useAppKeyboardShortcuts } from "@/hooks/useAppKeyboardShortcuts";
import { useCreateAndOpenNote } from "@/hooks/useCreateAndOpenNote";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { useSuspenseLoadNote } from "@/hooks/useSuspenseLoadNote";
import type { Note } from "@/services/notes/types";
import { useTabStore } from "@/stores/tabStore";
import { router, useLocalSearchParams } from "expo-router";
import React, { Suspense, useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";

function NewNoteEditorContent({
	id,
	initialTitle,
	initialNoteType,
}: {
	id: string;
	initialTitle?: string;
	initialNoteType?: string;
}) {
	const virtualNote: Note = {
		id,
		title: initialTitle ?? "",
		content: "",
		isPinned: false,
		noteType: (initialNoteType as Note["noteType"]) ?? "note",
		lastUpdated: Date.now(),
	};
	return <NoteEditorView note={virtualNote} isNew />;
}

function ExistingNoteEditorContent({ id }: { id: string }) {
	const note = useSuspenseLoadNote(id);

	if (!note) {
		return <ErrorScreen errorMessage="Note not found" onRetry={() => {}} />;
	}

	return <NoteEditorView note={note} />;
}

function NoteEditorContent({
	id,
	isNew,
	initialTitle,
	initialNoteType,
}: {
	id: string;
	isNew?: boolean;
	initialTitle?: string;
	initialNoteType?: string;
}) {
	if (isNew) {
		return (
			<NewNoteEditorContent
				id={id}
				initialTitle={initialTitle}
				initialNoteType={initialNoteType}
			/>
		);
	}
	return <ExistingNoteEditorContent id={id} />;
}

export default function NoteEditorScreen() {
	const params = useLocalSearchParams();
	const { activeTabId, tabs, closeTab } = useTabStore();
	const activeTab = tabs.find((t) => t.id === activeTabId);
	const noteId =
		typeof params.id === "string" && params.id
			? params.id
			: (activeTab?.noteId ?? "");
	const isNew = params.isNew === "true";
	const initialTitle =
		typeof params.title === "string" ? params.title : undefined;
	const initialNoteType =
		typeof params.noteType === "string" ? params.noteType : undefined;

	const createAndOpenNote = useCreateAndOpenNote();

	const handleCloseActiveTab = useCallback(() => {
		const currentActiveId = activeTabId || tabs.find(t => t.noteId === noteId)?.id;
		if (!currentActiveId) return;

		closeTab(currentActiveId);
		const { activeTabId: nextId, tabs: remaining } = useTabStore.getState();
		if (nextId) {
			const nextTab = remaining.find((t) => t.id === nextId);
			if (nextTab) {
				router.replace(`/editor?id=${nextTab.noteId}`);
				return;
			}
		}
		router.replace("/");
	}, [activeTabId, tabs, noteId, closeTab]);

	useEffect(() => {
		if (noteId) {
			useTabStore.getState().openTab(noteId, initialTitle);
		}
	}, [noteId, initialTitle]);

	useAppKeyboardShortcuts({
		onNewTab: () => void createAndOpenNote(),
		onCloseTab: handleCloseActiveTab,
	});

	const styles = useStyles(createStyles);

	if (!noteId) {
		return (
			<View style={styles.screen}>
				<View style={styles.content}>
					<ErrorScreen errorMessage="Note not found" onRetry={() => {}} />
				</View>
			</View>
		);
	}
	return (
		<View style={styles.screen}>
			<TabBar />
			<View style={styles.content}>
				<QueryErrorBoundary
					fallbackRender={(error) => (
						<ErrorScreen errorMessage={error.message} onRetry={() => {}} />
					)}
				>
					<Suspense fallback={<Loader />}>
						<NoteEditorContent
							id={noteId}
							isNew={isNew}
							initialTitle={initialTitle}
							initialNoteType={initialNoteType}
						/>
					</Suspense>
				</QueryErrorBoundary>
			</View>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		screen: {
			flex: 1,
			backgroundColor: theme.colors.background,
		},
		content: {
			flex: 1,
		},
		toolbarWrapper: {
			position: "absolute",
			left: 0,
			right: 0,
			backgroundColor: theme.colors.background,
			borderTopWidth: 1,
			borderTopColor: theme.colors.border,
		},
		titleInput: {
			fontSize: 20,
			fontWeight: "600",
			marginBottom: 8,
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.border,
			paddingVertical: 4,
			color: theme.colors.text,
		},
	});
}
