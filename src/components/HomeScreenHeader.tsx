import NoteFiltersDropdown from "@/components/NoteFiltersDropdown";
import { SearchBar } from "@/components/shared/SearchBar";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { NoteStatus, NoteType } from "@/services/notes/types";
import { MaterialIcons } from "@expo/vector-icons";
import type React from "react";
import {
	StyleSheet,
	type TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeScreenHeader({
	searchQuery,
	setSearchQuery,
	searchInputRef,
	noteTypes,
	status,
	onNoteTypesChange,
	onStatusChange,
	onReset,
	resetDisabled = false,
}: {
	searchQuery: string;
	setSearchQuery: (query: string) => void;
	searchInputRef?: React.Ref<TextInput>;
	noteTypes: NoteType[];
	status?: NoteStatus;
	onNoteTypesChange: (value: NoteType[]) => void;
	onStatusChange: (value?: NoteStatus) => void;
	onReset: () => void;
	resetDisabled?: boolean;
}) {
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);
	const insets = useSafeAreaInsets();

	return (
		<View style={[styles.shell, { paddingTop: insets.top + 12 }]}>
			<View style={styles.row}>
				<MaterialIcons
					name="sticky-note-2"
					size={24}
					color={theme.colors.primaryContrast}
				/>
				<SearchBar
					ref={searchInputRef}
					searchQuery={searchQuery}
					setSearchQuery={setSearchQuery}
					compact
				/>
				<NoteFiltersDropdown
					noteTypes={noteTypes}
					status={status}
					onNoteTypesChange={onNoteTypesChange}
					onStatusChange={onStatusChange}
				/>
				<View style={styles.actions}>
					<TouchableOpacity
						testID="home-reset-button"
						accessibilityRole="button"
						onPress={onReset}
						disabled={resetDisabled}
					>
						<MaterialIcons
							name="delete-forever"
							size={22}
							color={
								resetDisabled ? theme.colors.textFaded : theme.colors.error
							}
						/>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		shell: {
			position: "relative",
			zIndex: 40,
			elevation: 8,
			overflow: "visible",
			paddingHorizontal: 16,
			paddingTop: 12,
			paddingBottom: 8,
			backgroundColor: theme.colors.background,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
		},
		actions: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "flex-end",
			minWidth: 48,
		},
	});
}
