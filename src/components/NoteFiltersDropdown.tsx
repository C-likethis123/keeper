import {
	type FilterOption,
	NOTE_TYPE_OPTIONS,
	TODO_STATUS_OPTIONS,
} from "@/constants/noteTypes";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { NoteStatus, NoteType } from "@/services/notes/types";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

function getFilterLabel(noteTypes: NoteType[], status?: NoteStatus) {
	if (noteTypes.length === 0) {
		return "All notes";
	}
	if (noteTypes.length === 1) {
		const noteTypeLabel =
			NOTE_TYPE_OPTIONS.find((option) => option.value === noteTypes[0])
				?.label ?? "All notes";
		if (noteTypes[0] !== "todo") {
			return noteTypeLabel;
		}
		const statusLabel =
			TODO_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
			"All statuses";
		return `${noteTypeLabel}: ${statusLabel}`;
	}
	return `${noteTypes.length} types`;
}

function FilterSection<T extends string>({
	title,
	options,
	selectedValues,
	onToggle,
}: {
	title: string;
	options: FilterOption<T>[];
	selectedValues: T[];
	onToggle: (value?: T) => void;
}) {
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);

	return (
		<View style={styles.section}>
			<Text style={styles.sectionTitle}>{title}</Text>
			<View style={styles.optionList}>
				{options.map((option) => {
					const isSelected =
						option.value === undefined
							? selectedValues.length === 0
							: selectedValues.includes(option.value);
					return (
						<Pressable
							key={option.label}
							accessibilityRole={title === "Type" ? "checkbox" : "button"}
							accessibilityState={
								title === "Type" ? { checked: isSelected } : undefined
							}
							accessibilityLabel={option.label}
							style={({ pressed }) => [
								styles.option,
								isSelected && styles.optionSelected,
								pressed && styles.optionPressed,
							]}
							onPress={() => onToggle(option.value)}
						>
							<Text
								style={[
									styles.optionText,
									isSelected && styles.optionTextSelected,
								]}
							>
								{option.label}
							</Text>
							{isSelected ? (
								<MaterialIcons
									name="check"
									size={18}
									color={theme.colors.primaryContrast}
								/>
							) : null}
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

export default function NoteFiltersDropdown({
	noteTypes,
	status,
	onNoteTypesChange,
	onStatusChange,
}: {
	noteTypes: NoteType[];
	status?: NoteStatus;
	onNoteTypesChange: (value: NoteType[]) => void;
	onStatusChange: (value?: NoteStatus) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const styles = useStyles(createStyles);
	const summaryLabel = useMemo(
		() => getFilterLabel(noteTypes, status),
		[noteTypes, status],
	);

	const toggleNoteType = (value?: NoteType) => {
		if (value == null) {
			onNoteTypesChange([]);
			onStatusChange(undefined);
			setIsOpen(false);
			return;
		}
		const nextValues = noteTypes.includes(value)
			? noteTypes.filter((entry) => entry !== value)
			: [...noteTypes, value];
		onNoteTypesChange(nextValues);
		if (!nextValues.includes("todo")) {
			onStatusChange(undefined);
		}
	};

	return (
		<View style={styles.container}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Filter notes"
				style={({ pressed }) => [
					styles.trigger,
					isOpen && styles.triggerOpen,
					pressed && styles.triggerPressed,
				]}
				onPress={() => setIsOpen((current) => !current)}
			>
				<MaterialIcons name="filter-list" size={18} color="#6b7280" />
				<Text style={styles.triggerText} numberOfLines={1}>
					{summaryLabel}
				</Text>
				<MaterialIcons
					name={isOpen ? "expand-less" : "expand-more"}
					size={18}
					color="#6b7280"
				/>
			</Pressable>
			{isOpen ? (
				<View style={styles.menu}>
					<FilterSection
						title="Type"
						options={NOTE_TYPE_OPTIONS}
						selectedValues={noteTypes}
						onToggle={toggleNoteType}
					/>
					{noteTypes.includes("todo") ? (
						<FilterSection
							title="Status"
							options={TODO_STATUS_OPTIONS}
							selectedValues={status ? [status] : []}
							onToggle={(value) => {
								onStatusChange(value);
								setIsOpen(false);
							}}
						/>
					) : null}
				</View>
			) : null}
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			position: "relative",
			zIndex: 60,
		},
		trigger: {
			height: 48,
			maxWidth: 240,
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			paddingHorizontal: 14,
			borderRadius: 16,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
		},
		triggerOpen: {
			borderColor: theme.colors.primary,
		},
		triggerPressed: {
			opacity: 0.85,
		},
		triggerText: {
			flex: 1,
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.textMuted,
		},
		menu: {
			position: "absolute",
			top: 56,
			right: 0,
			zIndex: 80,
			width: 260,
			padding: 12,
			borderRadius: 18,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
			shadowColor: theme.colors.shadow,
			shadowOpacity: 0.14,
			shadowRadius: 14,
			shadowOffset: { width: 0, height: 8 },
			elevation: 5,
			gap: 12,
		},
		section: {
			gap: 8,
		},
		sectionTitle: {
			fontSize: 12,
			fontWeight: "700",
			textTransform: "uppercase",
			letterSpacing: 0.5,
			color: theme.colors.textFaded,
		},
		optionList: {
			gap: 6,
		},
		option: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: 12,
			paddingVertical: 10,
			borderRadius: 12,
			backgroundColor: theme.colors.background,
		},
		optionSelected: {
			backgroundColor: theme.colors.primary,
		},
		optionPressed: {
			opacity: 0.85,
		},
		optionText: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.text,
		},
		optionTextSelected: {
			color: theme.colors.primaryContrast,
		},
	});
}
