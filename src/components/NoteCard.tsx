import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { Note } from "@/services/notes/types";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

function formatNoteType(note: Note): string | null {
	if (!note.noteType || note.noteType === "note") return null;
	if (note.noteType === "todo") {
		if (note.status === "done") return "TODO DONE";
		if (note.status === "doing") return "TODO DOING";
		if (note.status === "blocked") return "TODO BLOCKED";
		return "TODO";
	}
	return note.noteType.toUpperCase();
}

export default function NoteCard({
	note,
	onDelete,
	onPinToggle,
}: {
	note: Note;
	onDelete: (note: Note) => void;
	onPinToggle: (updated: Note) => void;
}) {
	const router = useRouter();
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);
	const typeLabel = formatNoteType(note);

	const openNote = () => router.push(`/editor?id=${note.id}`);

	const handlePinToggle = () => {
		const updated = { ...note, isPinned: !note.isPinned };
		onPinToggle?.(updated);
	};

	return (
		<TouchableOpacity
			style={styles.card}
			onPress={openNote}
			activeOpacity={0.8}
		>
			<View style={styles.titleRow}>
				<Text style={styles.title} numberOfLines={2}>
					{note.title}
				</Text>

				{note.isPinned && (
					<TouchableOpacity
						onPress={handlePinToggle}
						hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
					>
						<MaterialIcons
							name="push-pin"
							size={18}
							color={theme.colors.primary}
						/>
					</TouchableOpacity>
				)}
			</View>

			<Text style={styles.content} numberOfLines={3}>
				{note.content}
			</Text>

			{typeLabel && (
				<View style={styles.badges}>
					{typeLabel ? (
						<View style={styles.badge}>
							<Text style={styles.badgeText}>{typeLabel}</Text>
						</View>
					) : null}
				</View>
			)}

			<View style={styles.footer}>
				<Text style={styles.date}>
					{new Date(note.lastUpdated).toLocaleDateString()}
				</Text>

				<View style={styles.actions}>
					{!note.isPinned && (
						<TouchableOpacity onPress={handlePinToggle}>
							<MaterialIcons
								name="push-pin"
								size={18}
								color={theme.colors.textMuted}
							/>
						</TouchableOpacity>
					)}
					<TouchableOpacity onPress={() => onDelete(note)}>
						<MaterialIcons
							name="delete-outline"
							size={18}
							color={theme.colors.textMuted}
						/>
					</TouchableOpacity>
				</View>
			</View>
		</TouchableOpacity>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		card: {
			flex: 1,
			borderRadius: 12,
			borderWidth: 1,
			borderColor: theme.colors.border,
			padding: 12,
			backgroundColor: theme.colors.card,
		},
		titleRow: {
			flexDirection: "row",
			gap: 6,
			alignItems: "flex-start",
		},
		title: {
			flex: 1,
			fontSize: 16,
			fontWeight: "600",
			color: theme.colors.text,
		},
		content: {
			marginTop: 6,
			color: theme.colors.textMuted,
			flexGrow: 1,
		},
		badges: {
			flexDirection: "row",
			gap: 6,
			marginTop: 10,
			flexWrap: "wrap",
		},
		badge: {
			borderRadius: 999,
			borderWidth: 1,
			borderColor: theme.colors.border,
			paddingHorizontal: 8,
			paddingVertical: 3,
			backgroundColor: theme.colors.background,
		},
		badgeText: {
			fontSize: 11,
			fontWeight: "600",
			color: theme.colors.textMuted,
		},
		footer: {
			marginTop: 8,
			flexDirection: "row",
			alignItems: "center",
		},
		date: {
			flex: 1,
			fontSize: 12,
			color: theme.colors.textFaded,
		},
		actions: {
			flexDirection: "row",
			gap: 12,
		},
	});
}
