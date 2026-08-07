import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import type { NoteVersion } from "@/services/notes/noteHistoryService";
import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { FontAwesome } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
	useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CurrentVersion = {
	id: "current";
	capturedAt: number;
	note: Note;
};

type DisplayVersion = CurrentVersion | NoteVersion;

export default function NoteHistoryModal({
	visible,
	note,
	onDismiss,
	onRestore,
}: {
	visible: boolean;
	note: Note;
	onDismiss: () => void;
	onRestore: (versionId: string) => Promise<void>;
}) {
	const styles = useStyles(createStyles);
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const [versions, setVersions] = useState<NoteVersion[]>([]);
	const [selectedId, setSelectedId] = useState<string>("current");
	const [loading, setLoading] = useState(false);
	const [restoring, setRestoring] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadVersions = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setVersions(await NoteService.listNoteVersions(note.id));
			setSelectedId("current");
		} catch {
			setError("Failed to load version history.");
		} finally {
			setLoading(false);
		}
	}, [note.id]);

	useEffect(() => {
		if (visible) void loadVersions();
	}, [loadVersions, visible]);

	const displayVersions = useMemo<DisplayVersion[]>(
		() => [
			{
				id: "current",
				capturedAt: note.modified ?? note.lastUpdated,
				note,
			},
			...versions,
		],
		[note, versions],
	);
	const selected =
		displayVersions.find((version) => version.id === selectedId) ??
		displayVersions[0];

	const restoreSelected = useCallback(async () => {
		if (!selected || selected.id === "current") return;
		setRestoring(true);
		setError(null);
		try {
			await onRestore(selected.id);
			onDismiss();
		} catch {
			setError("Failed to restore version.");
		} finally {
			setRestoring(false);
		}
	}, [onDismiss, onRestore, selected]);

	if (!visible) return null;

	const isWide = width >= 720;
	const preview =
		selected.note.noteType === "drawing"
			? "Drawing snapshot"
			: selected.note.content || "Empty note";

	return (
		<Modal visible animationType="slide" onRequestClose={onDismiss}>
			<View style={styles.screen}>
				<View style={[styles.header, { paddingTop: insets.top + 14 }]}>
					<View style={styles.headingGroup}>
						<Text style={styles.title} selectable>
							Version history
						</Text>
						<Text style={styles.noteTitle} numberOfLines={1} selectable>
							{note.title || "Untitled"}
						</Text>
					</View>
					<Pressable
						onPress={onDismiss}
						style={styles.iconButton}
						accessibilityRole="button"
						accessibilityLabel="Close version history"
					>
						<FontAwesome name="close" size={22} style={styles.icon} />
					</Pressable>
				</View>

				{loading ? (
					<View style={styles.centered}>
						<ActivityIndicator />
					</View>
				) : (
					<View style={[styles.content, isWide ? styles.contentWide : null]}>
						<ScrollView
							style={[styles.timeline, isWide ? styles.timelineWide : null]}
							contentContainerStyle={styles.timelineContent}
						>
							{displayVersions.map((version, index) => {
								const selectedVersion = version.id === selected.id;
								return (
									<Pressable
										key={version.id}
										onPress={() => setSelectedId(version.id)}
										style={[
											styles.versionRow,
											selectedVersion ? styles.versionRowSelected : null,
										]}
										accessibilityRole="button"
										accessibilityState={{ selected: selectedVersion }}
									>
										<View style={styles.timelineMarker} />
										<View style={styles.versionTextGroup}>
											<Text style={styles.versionLabel} selectable>
												{index === 0
													? "Current version"
													: formatVersionTime(version.capturedAt)}
											</Text>
											{index > 0 ? (
												<Text style={styles.versionDate} selectable>
													{formatVersionDate(version.capturedAt)}
												</Text>
											) : null}
										</View>
									</Pressable>
								);
							})}
						</ScrollView>

						<View style={styles.previewPane}>
							<View style={styles.previewHeader}>
								<View style={styles.headingGroup}>
									<Text style={styles.previewTitle} selectable>
										{selected.id === "current"
											? "Current version"
											: formatVersionDateTime(selected.capturedAt)}
									</Text>
									<Text style={styles.previewSubtitle} selectable>
										{selected.note.title || "Untitled"}
									</Text>
								</View>
								{selected.id !== "current" ? (
									<Pressable
										disabled={restoring}
										onPress={() => void restoreSelected()}
										style={({ pressed }) => [
											styles.restoreButton,
											pressed || restoring ? styles.buttonPressed : null,
										]}
										accessibilityRole="button"
									>
										<Text style={styles.restoreButtonText}>
											{restoring ? "Restoring…" : "Restore this version"}
										</Text>
									</Pressable>
								) : null}
							</View>
							<ScrollView
								style={styles.previewScroll}
								contentContainerStyle={[
									styles.previewContent,
									{ paddingBottom: insets.bottom + 24 },
								]}
							>
								<Text style={styles.previewText} selectable>
									{preview}
								</Text>
							</ScrollView>
						</View>
					</View>
				)}
				{error ? (
					<View
						style={[styles.errorBar, { paddingBottom: insets.bottom + 10 }]}
					>
						<Text style={styles.errorText} selectable>
							{error}
						</Text>
						<Pressable onPress={() => void loadVersions()}>
							<Text style={styles.retryText}>Retry</Text>
						</Pressable>
					</View>
				) : null}
			</View>
		</Modal>
	);
}

function formatVersionTime(timestamp: number): string {
	return new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
	}).format(timestamp);
}

function formatVersionDate(timestamp: number): string {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(timestamp);
}

function formatVersionDateTime(timestamp: number): string {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(timestamp);
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		screen: { flex: 1, backgroundColor: theme.colors.background },
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: 20,
			paddingVertical: 14,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		headingGroup: { flex: 1, minWidth: 0, gap: 2 },
		title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
		noteTitle: { fontSize: 13, color: theme.colors.textMuted },
		iconButton: { padding: 8 },
		icon: { color: theme.colors.text },
		centered: { flex: 1, alignItems: "center", justifyContent: "center" },
		content: { flex: 1, minHeight: 0 },
		contentWide: { flexDirection: "row" },
		timeline: {
			maxHeight: 220,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		timelineWide: {
			width: 280,
			maxHeight: undefined,
			borderRightWidth: StyleSheet.hairlineWidth,
			borderRightColor: theme.colors.border,
			borderBottomWidth: 0,
		},
		timelineContent: { padding: 12, gap: 4 },
		versionRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			paddingHorizontal: 12,
			paddingVertical: 10,
			borderRadius: 10,
		},
		versionRowSelected: { backgroundColor: theme.colors.card },
		timelineMarker: {
			width: 10,
			height: 10,
			borderRadius: 5,
			backgroundColor: theme.colors.primary,
		},
		versionTextGroup: { flex: 1, gap: 2 },
		versionLabel: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
		versionDate: { fontSize: 12, color: theme.colors.textMuted },
		previewPane: { flex: 1, minWidth: 0, minHeight: 0 },
		previewHeader: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			padding: 16,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		previewTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
		previewSubtitle: { fontSize: 13, color: theme.colors.textMuted },
		restoreButton: {
			borderRadius: 9,
			backgroundColor: theme.colors.primary,
			paddingHorizontal: 14,
			paddingVertical: 10,
		},
		buttonPressed: { opacity: 0.7 },
		restoreButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
		previewScroll: { flex: 1 },
		previewContent: { padding: 24 },
		previewText: {
			fontSize: 15,
			lineHeight: 23,
			color: theme.colors.text,
			fontFamily: "monospace",
		},
		errorBar: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: 16,
			paddingVertical: 10,
			backgroundColor: theme.colors.card,
		},
		errorText: { color: "#e03e3e", fontSize: 13 },
		retryText: { color: theme.colors.primary, fontSize: 13, fontWeight: "700" },
	});
}
