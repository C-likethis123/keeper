import NoteCard from "@/components/NoteCard";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import type { Note } from "@/services/notes/types";
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	View,
	useWindowDimensions,
} from "react-native";
import EmptyState from "./EmptyState";

export default function NoteGrid({
	notes,
	onDelete,
	onPinToggle,
	refreshing = false,
	onRefresh,
	onEndReached,
	isLoadingMore = false,
	hasMore = false,
}: {
	notes: Note[];
	onDelete: (note: Note) => void;
	onPinToggle: (updated: Note) => void;
	refreshing?: boolean;
	onRefresh: () => void;
	onEndReached?: () => void;
	isLoadingMore?: boolean;
	hasMore?: boolean;
}) {
	const { width } = useWindowDimensions();
	const theme = useExtendedTheme();

	// Responsive column count (matches Flutter logic)
	let numColumns = 2;
	if (width > 900) numColumns = 4;
	else if (width > 600) numColumns = 3;

	const handleEndReached = () => {
		if (hasMore && !isLoadingMore) {
			onEndReached?.();
		}
	};

	return (
		<FlatList
			data={notes}
			key={numColumns}
			numColumns={numColumns}
			keyExtractor={(item, index) => `${item.filePath}-${index}`}
			columnWrapperStyle={{ gap: 8, marginBottom: 8 }}
			contentContainerStyle={{
				padding: 8,
				paddingBottom: 100,
			}}
			ListEmptyComponent={
				<EmptyState
					title="No notes found"
					subtitle="Create a note to get started"
				/>
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
					<View style={{ padding: 16, alignItems: "center" }}>
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
