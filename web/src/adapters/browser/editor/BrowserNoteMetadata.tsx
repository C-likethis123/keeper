import { FilterChip } from "@keeper/components/shared/FilterChip";
import { TODO_STATUS_OPTIONS } from "@keeper/constants/noteTypes";
import { darkTheme } from "@keeper/constants/themes/darkTheme";
import type {
	CanonicalNoteStatus,
	CanonicalNoteType,
} from "@keeper/features/notes/note-contract";
import { ThemeProvider } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";

/** Browser renderer for the same Todo status controls in NoteEditorView. */
export function BrowserNoteMetadata({
	noteType,
	status,
	onStatus,
}: {
	noteType: CanonicalNoteType;
	status: CanonicalNoteStatus | null;
	onStatus: (status: CanonicalNoteStatus) => void;
}) {
	if (noteType !== "todo") return null;
	return (
		<ThemeProvider value={darkTheme}>
			<View style={styles.group} accessibilityLabel="Todo status">
				<Text style={styles.label}>Status</Text>
				<View style={styles.row}>
					{TODO_STATUS_OPTIONS.map((option) => (
						<FilterChip
							key={option.value}
							label={option.label}
							selected={(status ?? "open") === option.value}
							onPress={() => onStatus(option.value ?? "open")}
						/>
					))}
				</View>
			</View>
		</ThemeProvider>
	);
}

const styles = StyleSheet.create({
	group: { gap: 6 },
	label: {
		fontSize: 12,
		fontWeight: "600",
		color: darkTheme.colors.textMuted,
		textTransform: "uppercase",
	},
	row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
