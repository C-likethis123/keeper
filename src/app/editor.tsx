import NoteEditorView from "@/components/NoteEditorView";
import { TOOLBAR_HEIGHT } from "@/components/editor/editorConstants";
import ErrorScreen from "@/components/shared/ErrorScreen";
import Loader from "@/components/shared/Loader";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useLoadNote } from "@/hooks/useLoadNote";
import { useStyles } from "@/hooks/useStyles";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

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
				<NoteEditorView note={note} />
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
