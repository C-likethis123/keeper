import { TOOLBAR_HEIGHT } from "@/components/editor/editorConstants";
import ErrorScreen from "@/components/shared/ErrorScreen";
import Loader from "@/components/shared/Loader";
import QueryErrorBoundary from "@/components/shared/QueryErrorBoundary";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useSuspenseLoadNote } from "@/hooks/useSuspenseLoadNote";
import { useStyles } from "@/hooks/useStyles";
import type { Note } from "@/services/notes/types";
import { useLocalSearchParams } from "expo-router";
import React, { Suspense } from "react";
import { StyleSheet, View } from "react-native";

const LazyNoteEditorView = React.lazy(
	() => import("@/components/NoteEditorView"),
);

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
	const note = useSuspenseLoadNote(id);

	if (!note) {
		if (isNew) {
			const virtualNote: Note = {
				id,
				title: initialTitle ?? "",
				content: "",
				isPinned: false,
				noteType: (initialNoteType as Note["noteType"]) ?? "note",
				lastUpdated: Date.now(),
			};
			return (
				<Suspense fallback={<Loader />}>
					<LazyNoteEditorView note={virtualNote} isNew />
				</Suspense>
			);
		}
		return <ErrorScreen errorMessage="Note not found" onRetry={() => {}} />;
	}

	return (
		<Suspense fallback={<Loader />}>
			<LazyNoteEditorView note={note} />
		</Suspense>
	);
}

export default function NoteEditorScreen() {
	const params = useLocalSearchParams();
	const noteId = typeof params.id === "string" ? params.id : "";
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
