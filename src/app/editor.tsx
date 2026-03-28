import { TOOLBAR_HEIGHT } from "@/components/editor/editorConstants";
import ErrorScreen from "@/components/shared/ErrorScreen";
import Loader from "@/components/shared/Loader";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useLoadNote } from "@/hooks/useLoadNote";
import { useStyles } from "@/hooks/useStyles";
import { useLocalSearchParams } from "expo-router";
import React, { Suspense } from "react";
import { Platform, StyleSheet, View } from "react-native";

const LazyNoteEditorView = React.lazy(
	() => import("@/components/NoteEditorView"),
);

export default function NoteEditorScreen() {
	const params = useLocalSearchParams();
	const { id } = params;

	const { isLoading, error, note } = useLoadNote(id as string);

	const styles = useStyles(createStyles);

	if (isLoading) {
		return (
			<View style={styles.screen}>
				<View style={styles.content}>
					<Loader />
				</View>
			</View>
		);
	}
	if (error || !note) {
		return (
			<View style={styles.screen}>
				<View style={styles.content}>
					<ErrorScreen
						errorMessage={error ?? "Note not found"}
						onRetry={() => {}}
					/>
				</View>
			</View>
		);
	}
	return (
		<View style={styles.screen}>
			<View style={styles.content}>
				<Suspense fallback={<Loader />}>
					<LazyNoteEditorView note={note} />
				</Suspense>
			</View>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	const bottomPadding = Platform.OS === "web" ? 16 : 16 + TOOLBAR_HEIGHT;

	return StyleSheet.create({
		screen: {
			flex: 1,
		},
		content: {
			flex: 1,
			padding: 16,
			paddingBottom: bottomPadding,
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
