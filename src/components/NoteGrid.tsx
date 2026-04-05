import NoteCard from "@/components/NoteCard";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { Note } from "@/services/notes/types";
import type React from "react";
import { useCallback, useMemo } from "react";
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	StyleSheet,
	View,
	useWindowDimensions,
} from "react-native";
import EmptyState from "./shared/EmptyState";

export default function NoteGrid({
	notes,
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

	return (
		<FlatList
			data={notes}
			key={numColumns}
			numColumns={numColumns}
			keyExtractor={(item) => item.id}
			columnWrapperStyle={styles.columnWrapper}
			contentContainerStyle={styles.contentContainer}
			ListHeaderComponent={listHeaderComponent}
			ListEmptyComponent={
				<EmptyState title={emptyTitle} subtitle={emptySubtitle} />
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
			renderItem={({ item }) => (
				<NoteCard note={item} onDelete={onDelete} onPinToggle={onPinToggle} />
			)}
		/>
	);
}

function createStyles(_theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
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
	});
}
