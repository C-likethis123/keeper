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

	// Flatten sections into a list with headers
	const flattenedData = useMemo(() => {
		if (sections && sections.length > 0) {
			const items: Array<
				{ type: "header"; section: NoteSection } | { type: "note"; note: Note }
			> = [];
			for (const section of sections) {
				items.push({ type: "header", section });
				for (const note of section.notes) {
					items.push({ type: "note", note });
				}
			}
			return items;
		}
		// Fallback to flat notes
		return notes.map((note) => ({ type: "note" as const, note }));
	}, [sections, notes]);

	const isEmpty = flattenedData.filter((d) => d.type === "note").length === 0;

	const listHeader = useMemo(() => {
		if (!listHeaderComponent) return null;
		return <View style={styles.headerWrapper}>{listHeaderComponent}</View>;
	}, [listHeaderComponent, styles.headerWrapper]);

	return (
		<View style={styles.root}>
			{listHeader}
			<FlatList
				data={flattenedData}
				key={numColumns}
				numColumns={numColumns}
				keyExtractor={(item, index) =>
					item.type === "header"
						? `header-${item.section.id}`
						: `note-${item.note.id}-${index}`
				}
				columnWrapperStyle={styles.columnWrapper}
				contentContainerStyle={styles.contentContainer}
				ListHeaderComponent={null}
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
						<NoteCard
							note={item.note}
							onDelete={onDelete}
							onPinToggle={onPinToggle}
						/>
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
			paddingHorizontal: 8,
			paddingTop: 12,
		},
		columnWrapper: {
			gap: 8,
			marginBottom: 8,
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
