import NoteCard from "@/components/NoteCard";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { NoteSection } from "@/services/notes/indexDb/types";
import type { Note } from "@/services/notes/types";
import type React from "react";
import { useCallback, useMemo } from "react";
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	StyleSheet,
	Text,
	View,
	useWindowDimensions,
} from "react-native";
import EmptyState from "./shared/EmptyState";

export default function NoteGrid({
	notes,
	sections,
	emptyTitle = "No notes found",
	emptySubtitle = "Create a note to get started",
	onDelete,
	onPinToggle,
	refreshing = false,
	onRefresh,
	onEndReached,
	isLoadingMore = false,
	hasMore = false,
	listHeaderComponent,
}: {
	notes: Note[];
	sections?: NoteSection[];
	emptyTitle?: string;
	emptySubtitle?: string;
	onDelete: (note: Note) => void;
	onPinToggle: (updated: Note) => void;
	refreshing?: boolean;
	onRefresh: () => void;
	onEndReached?: () => void;
	isLoadingMore?: boolean;
	hasMore?: boolean;
	listHeaderComponent?: React.ReactElement | null;
}) {
	const { width } = useWindowDimensions();
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);

	// Responsive column count (matches Flutter logic)
	let numColumns = 2;
	if (width > 900) numColumns = 4;
	else if (width > 600) numColumns = 3;

	const handleEndReached = useCallback(() => {
		if (hasMore && !isLoadingMore) {
			onEndReached?.();
		}
	}, [hasMore, isLoadingMore, onEndReached]);

	const rowData = useMemo(() => {
		const chunkNotes = (sectionNotes: Note[]) => {
			const rows: Note[][] = [];
			for (let index = 0; index < sectionNotes.length; index += numColumns) {
				rows.push(sectionNotes.slice(index, index + numColumns));
			}
			return rows;
		};

		if (sections && sections.length > 0) {
			const items: Array<
				| { type: "header"; section: NoteSection }
				| { type: "note-row"; notes: Note[] }
			> = [];
			for (const section of sections) {
				items.push({ type: "header", section });
				for (const row of chunkNotes(section.notes)) {
					items.push({ type: "note-row", notes: row });
				}
			}
			return items;
		}

		return chunkNotes(notes).map((row) => ({
			type: "note-row" as const,
			notes: row,
		}));
	}, [notes, numColumns, sections]);

	const isEmpty = rowData.length === 0;

	const listHeader = useMemo(() => {
		if (!listHeaderComponent) return null;
		return <View style={styles.headerWrapper}>{listHeaderComponent}</View>;
	}, [listHeaderComponent, styles.headerWrapper]);

	return (
		<View style={styles.root}>
			<FlatList
				data={rowData}
				key={`note-grid-${numColumns}`}
				keyExtractor={(item, index) =>
					item.type === "header"
						? `header-${item.section.id}`
						: `note-row-${item.notes.map((note) => note.id).join("-")}-${index}`
				}
				contentContainerStyle={styles.contentContainer}
				ListHeaderComponent={listHeader}
				ListEmptyComponent={
					isEmpty ? (
						<EmptyState title={emptyTitle} subtitle={emptySubtitle} />
					) : undefined
				}
				showsVerticalScrollIndicator
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={theme.colors.primary}
						colors={[theme.colors.primary]}
					/>
				}
				onEndReached={handleEndReached}
				onEndReachedThreshold={0.5}
				ListFooterComponent={
					isLoadingMore ? (
						<View style={styles.footerLoader}>
							<ActivityIndicator size="small" color={theme.colors.primary} />
						</View>
					) : null
				}
				renderItem={({ item }) => {
					if (item.type === "header") {
						return (
							<View style={styles.sectionHeader}>
								<Text style={styles.sectionHeaderText}>
									{item.section.title}
								</Text>
							</View>
						);
					}

					return (
						<View style={styles.noteRow}>
							{item.notes.map((note) => (
								<View key={note.id} style={styles.noteCell}>
									<NoteCard
										note={note}
										onDelete={onDelete}
										onPinToggle={onPinToggle}
									/>
								</View>
							))}
							{Array.from(
								{ length: Math.max(0, numColumns - item.notes.length) },
								(_, offset) => item.notes.length + offset + 1,
							).map((columnNumber) => (
								<View
									key={`empty-column-${columnNumber}`}
									style={styles.noteCell}
									pointerEvents="none"
								/>
							))}
						</View>
					);
				}}
			/>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		root: {
			flex: 1,
		},
		headerWrapper: {
			maxWidth: 640,
			width: "100%",
			alignSelf: "center",
		},
		noteRow: {
			flexDirection: "row",
			gap: 8,
			marginBottom: 8,
		},
		noteCell: {
			flex: 1,
		},
		contentContainer: {
			padding: 8,
			paddingBottom: 100,
		},
		footerLoader: {
			padding: 16,
			alignItems: "center",
		},
		sectionHeader: {
			paddingHorizontal: 8,
			paddingVertical: 12,
			marginTop: 8,
		},
		sectionHeaderText: {
			fontSize: 18,
			fontWeight: "700",
			color: theme.colors.text,
		},
	});
}
