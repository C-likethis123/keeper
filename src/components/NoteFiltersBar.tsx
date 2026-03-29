import { FilterChip } from "@/components/shared/FilterChip";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import type { NoteStatus, NoteType } from "@/services/notes/types";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

type FilterOption<T extends string> = {
	label: string;
	value?: T;
};

const NOTE_TYPE_OPTIONS: FilterOption<NoteType>[] = [
	{ label: "All", value: undefined },
	{ label: "Notes", value: "note" },
	{ label: "Journals", value: "journal" },
	{ label: "Resources", value: "resource" },
	{ label: "Todos", value: "todo" },
];

const TODO_STATUS_OPTIONS: FilterOption<NoteStatus>[] = [
	{ label: "All", value: undefined },
	{ label: "Open", value: "open" },
	{ label: "Doing", value: "doing" },
	{ label: "Blocked", value: "blocked" },
	{ label: "Done", value: "done" },
];

export function NoteFiltersBar({
	noteType,
	status,
	onNoteTypeChange,
	onStatusChange,
}: {
	noteType?: NoteType;
	status?: NoteStatus;
	onNoteTypeChange: (value?: NoteType) => void;
	onStatusChange: (value?: NoteStatus) => void;
}) {
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);

	return (
		<View style={styles.container}>
			<View style={styles.row}>
				{NOTE_TYPE_OPTIONS.map((option) => (
					<FilterChip
						key={option.label}
						label={option.label}
						selected={noteType === option.value}
						onPress={() => onNoteTypeChange(option.value)}
					/>
				))}
			</View>
			{noteType === "todo" ? (
				<View style={styles.row}>
					{TODO_STATUS_OPTIONS.map((option) => (
						<FilterChip
							key={option.label}
							label={option.label}
							selected={status === option.value}
							onPress={() => onStatusChange(option.value)}
						/>
					))}
				</View>
			) : null}
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			paddingHorizontal: 16,
			paddingBottom: 8,
			gap: 8,
			backgroundColor: theme.colors.background,
		},
		row: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: 8,
		},
	});
}
