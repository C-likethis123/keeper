import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { Note } from "@/services/notes/types";
import { router } from "expo-router";
import React from "react";
import {
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface NoteRelatedNotesProps {
	backlinks: Note[];
	outgoing: Note[];
	loading: boolean;
	onNavigate: (noteId: string) => void;
}

function NoteLink({
	note,
	onNavigate,
}: {
	note: Note;
	onNavigate: (noteId: string) => void;
}) {
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);

	return (
		<TouchableOpacity
			style={styles.noteLink}
			onPress={() => onNavigate(note.id)}
		>
			<MaterialCommunityIcons
				name="file-document-outline"
				size={16}
				color={theme.colors.textSecondary}
			/>
			<Text
				style={[styles.noteLinkText, { color: theme.colors.text }]}
				numberOfLines={1}
			>
				{note.title || "Untitled"}
			</Text>
		</TouchableOpacity>
	);
}

function NoteList({
	title,
	icon,
	notes,
	onNavigate,
	emptyLabel,
}: {
	title: string;
	icon: string;
	notes: Note[];
	onNavigate: (noteId: string) => void;
	emptyLabel: string;
}) {
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);

	return (
		<View style={styles.section}>
			<View style={styles.sectionHeader}>
				<MaterialCommunityIcons
					name={icon as typeof MaterialCommunityIcons.defaultProps.name}
					size={18}
					color={theme.colors.textSecondary}
				/>
				<Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
					{title}
				</Text>
				<Text style={[styles.sectionCount, { color: theme.colors.textSecondary }]}>
					{notes.length}
				</Text>
			</View>
			{notes.length === 0 ? (
				<Text style={[styles.emptyLabel, { color: theme.colors.textSecondary }]}>
					{emptyLabel}
				</Text>
			) : (
				notes.map((note) => (
					<NoteLink key={note.id} note={note} onNavigate={onNavigate} />
				))
			)}
		</View>
	);
}

export default function NoteRelatedNotes({
	backlinks,
	outgoing,
	loading,
	onNavigate,
}: NoteRelatedNotesProps) {
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);

	if (loading) {
		return (
			<View style={styles.container}>
				<Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
					Loading related notes...
				</Text>
			</View>
		);
	}

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<NoteList
				title="Backlinks"
				icon="link-variant"
				notes={backlinks}
				onNavigate={onNavigate}
				emptyLabel="No notes link to this note"
			/>
			<NoteList
				title="References"
				icon="export-variant"
				notes={outgoing}
				onNavigate={onNavigate}
				emptyLabel="This note doesn't reference anything"
			/>
		</ScrollView>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			flex: 1,
		},
		content: {
			padding: 16,
			gap: 16,
		},
		loadingText: {
			padding: 16,
			textAlign: "center",
		},
		section: {
			gap: 8,
		},
		sectionHeader: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
		},
		sectionTitle: {
			fontSize: 15,
			fontWeight: "600",
			flex: 1,
		},
		sectionCount: {
			fontSize: 13,
			fontWeight: "400",
		},
		emptyLabel: {
			fontSize: 13,
			paddingLeft: 24,
		},
		noteLink: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			paddingVertical: 6,
			paddingLeft: 24,
		},
		noteLinkText: {
			fontSize: 14,
			flex: 1,
		},
	});
}
