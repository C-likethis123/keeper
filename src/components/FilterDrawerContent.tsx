import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import type { NoteStatus, NoteType } from "@/services/notes/types";
import { useFilterStore } from "@/stores/filterStore";
import { FontAwesome } from "@expo/vector-icons";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FILTER_OPTIONS: { label: string; value?: NoteType }[] = [
	{ label: "All notes", value: undefined },
	{ label: "Journals", value: "journal" },
	{ label: "Resources", value: "resource" },
	{ label: "Todos", value: "todo" },
];

const STATUS_OPTIONS: { label: string; value?: NoteStatus }[] = [
	{ label: "All", value: undefined },
	{ label: "Open", value: "open" },
	{ label: "Doing", value: "doing" },
	{ label: "Blocked", value: "blocked" },
	{ label: "Done", value: "done" },
];

function FilterRow({
	label,
	selected,
	onPress,
	theme,
	styles,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
	theme: ExtendedTheme;
	styles: ReturnType<typeof createStyles>;
}) {
	return (
		<Pressable
			style={[styles.option, selected && styles.optionSelected]}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityState={{ selected }}
		>
			<Text style={[styles.optionText, selected && styles.optionTextSelected]}>
				{label}
			</Text>
			{selected ? (
				<FontAwesome
					name="check"
					size={16}
					color={theme.colors.primaryContrast}
				/>
			) : null}
		</Pressable>
	);
}

export function FilterDrawerContent({
	navigation,
}: DrawerContentComponentProps) {
	const theme = useStyles(getTheme);
	const styles = useStyles(createStyles);
	const noteTypes = useFilterStore((s) => s.noteTypes);
	const status = useFilterStore((s) => s.status);
	const setNoteTypes = useFilterStore((s) => s.setNoteTypes);
	const setStatus = useFilterStore((s) => s.setStatus);
	const insets = useSafeAreaInsets();

	const selectedType = noteTypes.length > 0 ? noteTypes[0] : undefined;

	const handleSelectType = (value?: NoteType) => {
		if (value == null) {
			setNoteTypes([]);
			setStatus(undefined);
		} else {
			setNoteTypes([value]);
			if (value !== "todo") {
				setStatus(undefined);
			}
		}
	};

	const handleSelectStatus = (value?: NoteStatus) => {
		setStatus(value);
		navigation.closeDrawer();
	};

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Filter</Text>
				<Pressable
					onPress={() => navigation.closeDrawer()}
					accessibilityRole="button"
					accessibilityLabel="Close filter"
					hitSlop={8}
				>
					<FontAwesome name="times" size={20} color={theme.colors.textMuted} />
				</Pressable>
			</View>
			<ScrollView style={styles.content}>
				<Text style={styles.sectionTitle}>Type</Text>
				{FILTER_OPTIONS.map((option) => (
					<FilterRow
						key={option.label}
						label={option.label}
						selected={selectedType === option.value}
						onPress={() => handleSelectType(option.value)}
						theme={theme}
						styles={styles}
					/>
				))}
				{selectedType === "todo" ? (
					<>
						<Text style={[styles.sectionTitle, styles.sectionTop]}>Status</Text>
						{STATUS_OPTIONS.map((option) => (
							<FilterRow
								key={option.label}
								label={option.label}
								selected={status === option.value}
								onPress={() => handleSelectStatus(option.value)}
								theme={theme}
								styles={styles}
							/>
						))}
					</>
				) : null}
			</ScrollView>
		</View>
	);
}

function getTheme(theme: ExtendedTheme): ExtendedTheme {
	return theme;
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: theme.colors.background,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: 20,
			paddingVertical: 16,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		headerTitle: {
			fontSize: 20,
			fontWeight: "700",
			color: theme.colors.text,
		},
		content: {
			flex: 1,
			paddingHorizontal: 16,
			paddingVertical: 12,
		},
		sectionTitle: {
			fontSize: 12,
			fontWeight: "700",
			textTransform: "uppercase",
			letterSpacing: 0.5,
			color: theme.colors.textFaded,
			marginTop: 8,
			marginBottom: 6,
		},
		sectionTop: {
			marginTop: 16,
		},
		option: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: 12,
			paddingVertical: 12,
			borderRadius: 10,
			backgroundColor: theme.colors.card,
			marginBottom: 4,
		},
		optionSelected: {
			backgroundColor: theme.colors.primary,
		},
		optionText: {
			fontSize: 15,
			fontWeight: "600",
			color: theme.colors.text,
		},
		optionTextSelected: {
			color: theme.colors.primaryContrast,
		},
	});
}
