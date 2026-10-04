import DrawingPreview from "@/components/drawing/DrawingPreview";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { Note } from "@/services/notes/types";
import { FontAwesome } from "@/components/shared/Icons";
import { memo, useCallback, useMemo } from "react";
import {
	Alert,
	Platform,
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

function NoteCard({
	note,
	onOpen,
	onDelete,
	onPinToggle,
	onRemoveFromCluster,
}: {
	note: Note;
	onOpen: (note: Note) => void;
	onDelete: (note: Note) => void;
	onPinToggle: (updated: Note) => void;
	onRemoveFromCluster?: () => void;
}) {
	const styles = useStyles(createStyles);
	const typeLabel = useMemo(() => formatNoteType(note), [note]);
	const formattedDate = useMemo(
		() => new Date(note.lastUpdated).toLocaleDateString(),
		[note.lastUpdated],
	);
	const openNote = useCallback(() => {
		onOpen(note);
	}, [note, onOpen]);

	const handlePinToggle = useCallback(() => {
		const updated = { ...note, isPinned: !note.isPinned };
		onPinToggle?.(updated);
	}, [note, onPinToggle]);
	const handleLongPress = useCallback(() => {
		if (!onRemoveFromCluster) return;
		Alert.alert("Remove from cluster", "Remove this note from the cluster?", [
			{ text: "Cancel", style: "cancel" },
			{ text: "Remove", style: "destructive", onPress: onRemoveFromCluster },
		]);
	}, [onRemoveFromCluster]);

	return (
		<View style={styles.card}>
			<Pressable
				style={({ pressed }) => [
					styles.openArea,
					pressed && styles.cardPressed,
				]}
				onPress={openNote}
				onLongPress={
					onRemoveFromCluster && Platform.OS !== "web"
						? handleLongPress
						: undefined
				}
				accessibilityRole="button"
				accessibilityLabel={`Open note ${note.title || "Untitled"}`}
				accessibilityHint={
					onRemoveFromCluster && Platform.OS !== "web"
						? "Long press to remove from cluster"
						: undefined
				}
			>
				<View style={styles.titleRow}>
					<Text style={styles.title} numberOfLines={2}>
						{note.title}
					</Text>
					{note.isPinned ? (
						<FontAwesome
							name="thumb-tack"
							size={18}
							style={styles.activeIconButton}
						/>
					) : null}
				</View>

				{note.noteType === "drawing" ? (
					<View style={styles.drawingPreview}>
						<DrawingPreview content={note.content} />
					</View>
				) : (
					<Text style={styles.content} numberOfLines={3}>
						{note.content}
					</Text>
				)}

				{typeLabel && (
					<View style={styles.badges}>
						{typeLabel ? (
							<View style={styles.badge}>
								<Text style={styles.badgeText}>{typeLabel}</Text>
							</View>
						) : null}
					</View>
				)}
			</Pressable>

			<View style={styles.footer}>
				<Text style={styles.date}>{formattedDate}</Text>

				<View style={styles.actions}>
					{onRemoveFromCluster && (
						<Pressable
							onPress={onRemoveFromCluster}
							accessibilityRole="button"
							accessibilityLabel="Remove from cluster"
						>
							<FontAwesome name="times" size={18} style={styles.iconButton} />
						</Pressable>
					)}
					<Pressable
						onPress={handlePinToggle}
						accessibilityRole="button"
						accessibilityLabel={note.isPinned ? "Unpin note" : "Pin note"}
					>
						<FontAwesome
							name="thumb-tack"
							size={18}
							style={
								note.isPinned ? styles.activeIconButton : styles.iconButton
							}
						/>
					</Pressable>
					<Pressable
						onPress={() => onDelete(note)}
						accessibilityRole="button"
						accessibilityLabel="Delete note"
					>
						<FontAwesome name="trash-o" size={18} style={styles.iconButton} />
					</Pressable>
				</View>
			</View>
		</View>
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
		openArea: {
			flexGrow: 1,
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
		drawingPreview: {
			marginTop: 8,
			borderRadius: 8,
			overflow: "hidden",
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: theme.colors.border,
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

export default memo(NoteCard);
