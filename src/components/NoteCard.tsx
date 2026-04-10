import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { Note } from "@/services/notes/types";
import { useTabStore } from "@/stores/tabStore";
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
	type GestureResponderEvent,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

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
	const styles = useStyles(createStyles);
	const typeLabel = formatNoteType(note);
	const [isPressed, setIsPressed] = useState(false);

	const openNote = () => {
		useTabStore.getState().openTab(note.id, note.title);
		router.push(`/editor?id=${note.id}`);
	};

	const handlePinToggle = () => {
		const updated = { ...note, isPinned: !note.isPinned };
		onPinToggle?.(updated);
	};
	const stopCardPress = (event?: GestureResponderEvent) => {
		event?.stopPropagation?.();
	};

	return (
		<Pressable
			style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
			onPress={openNote}
			accessible={true}
			accessibilityRole="button"
			accessibilityLabel={`Open note ${note.title || "Untitled"}`}
			accessibilityHint="Opens the note"
		>
			<View style={styles.titleRow}>
				<Text style={styles.title} numberOfLines={2}>
					{note.title}
				</Text>

				{note.isPinned && (
					<Pressable
						onPress={(event) => {
							stopCardPress(event);
							handlePinToggle();
						}}
						accessibilityRole="button"
						accessibilityLabel="Unpin note"
						hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
					>
						<FontAwesome
							name="thumb-tack"
							size={18}
							style={styles.activeIconButton}
						/>
					</Pressable>
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
						<Pressable
							onPress={(event) => {
								stopCardPress(event);
								handlePinToggle();
							}}
							accessibilityRole="button"
							accessibilityLabel="Pin note"
						>
							<FontAwesome
								name="thumb-tack"
								size={18}
								style={styles.iconButton}
							/>
						</Pressable>
					)}
					<Pressable
						onPress={(event) => {
							stopCardPress(event);
							onDelete(note);
						}}
						accessibilityRole="button"
						accessibilityLabel="Delete note"
					>
						<FontAwesome name="trash-o" size={18} style={styles.iconButton} />
					</Pressable>
				</View>
			</View>
		</Pressable>
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
		cardPressed: {
			opacity: 0.8,
		},
		activeIconButton: {
			color: theme.colors.primary,
		},
		iconButton: {
			color: theme.colors.textMuted,
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
