import NoteFiltersDropdown from "@/components/NoteFiltersDropdown";
import { SearchBar } from "@/components/shared/SearchBar";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { NoteStatus, NoteType } from "@/services/notes/types";
import { MaterialIcons } from "@expo/vector-icons";
import type React from "react";
import {
	StyleSheet,
	Text,
	type TextInput,
	TouchableOpacity,
	View,
} from "react-native";

export default function HomeScreenHeader({
	searchQuery,
	setSearchQuery,
	searchEditable,
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
	searchEditable: boolean;
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

	return (
		<View style={styles.shell}>
			<View style={styles.row}>
				<View style={styles.brandGroup}>
					<View style={styles.brandBadge}>
						<MaterialIcons
							name="sticky-note-2"
							size={24}
							color={theme.colors.primaryContrast}
						/>
					</View>
					<Text style={styles.brandText}>Keeper</Text>
				</View>
				<View style={styles.searchWrap}>
					<View style={styles.searchRow}>
						<SearchBar
							ref={searchInputRef}
							searchQuery={searchQuery}
							setSearchQuery={setSearchQuery}
							editable={searchEditable}
							compact
						/>
						<NoteFiltersDropdown
							noteTypes={noteTypes}
							status={status}
							onNoteTypesChange={onNoteTypesChange}
							onStatusChange={onStatusChange}
						/>
					</View>
				</View>
				<View style={styles.actions}>
					<TouchableOpacity
						testID="home-reset-button"
						accessibilityRole="button"
						onPress={onReset}
						disabled={resetDisabled}
						style={styles.actionButton}
					>
						<MaterialIcons
							name="delete-forever"
							size={22}
							color={
								resetDisabled ? theme.colors.textFaded : theme.colors.textMuted
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
		brandGroup: {
			flexDirection: "row",
			alignItems: "center",
			minWidth: 132,
			gap: 10,
		},
		brandBadge: {
			width: 40,
			height: 40,
			borderRadius: 12,
			backgroundColor: theme.colors.primary,
			alignItems: "center",
			justifyContent: "center",
		},
		brandText: {
			fontSize: 28,
			fontWeight: "600",
			color: theme.colors.text,
		},
		searchWrap: {
			flex: 1,
			maxWidth: 960,
			overflow: "visible",
		},
		searchRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			overflow: "visible",
		},
		actions: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "flex-end",
			minWidth: 48,
		},
		actionButton: {
			width: 40,
			height: 40,
			borderRadius: 20,
			alignItems: "center",
			justifyContent: "center",
		},
	});
}
