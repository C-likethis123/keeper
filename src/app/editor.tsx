import NoteEditorView from "@/components/NoteEditorView";
import { TOOLBAR_HEIGHT } from "@/components/editor/editorConstants";
import ErrorScreen from "@/components/shared/ErrorScreen";
import Loader from "@/components/shared/Loader";
import QueryErrorBoundary from "@/components/shared/QueryErrorBoundary";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { useSuspenseLoadNote } from "@/hooks/useSuspenseLoadNote";
import type { Note } from "@/services/notes/types";
import { useTabStore } from "@/stores/tabStore";
import { useLocalSearchParams } from "expo-router";
import React, { Suspense, useEffect } from "react";
import { StyleSheet, View } from "react-native";

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

	const note = useSuspenseLoadNote(id);
	const { activeTabId, updateTabTitle } = useTabStore();

	useEffect(() => {
		if (activeTabId && note?.title) {
			updateTabTitle(activeTabId, note.title);
		}
	}, [activeTabId, note?.title, updateTabTitle]);

	if (!note) {
		return <ErrorScreen errorMessage="Note not found" onRetry={() => {}} />;
	}

	return <NoteEditorView note={note} />;
}

export default function NoteEditorScreen() {
	const params = useLocalSearchParams();
	const { activeTabId, tabs } = useTabStore();
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
		},
		content: {
			flex: 1,
			padding: 16,
			paddingBottom: 16 + TOOLBAR_HEIGHT,
			backgroundColor: theme.colors.background,
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
