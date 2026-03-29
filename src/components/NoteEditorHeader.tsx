import { SaveIndicator, type SaveStatus } from "@/components/SaveIndicator";
import { webTextInputReset } from "@/components/shared/textInputWebStyles";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import type { Note } from "@/services/notes/types";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
	StyleSheet,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
	title: string;
	status: SaveStatus;
	isPinned: boolean;
	noteType: Note["noteType"];
	onChangeTitle: (value: string) => void;
	onBlurTitle: () => void;
	onBack: () => void;
	onTogglePin: () => void;
	onDelete: () => void;
};

export default function NoteEditorHeader({
	title,
	status,
	isPinned,
	noteType,
	onChangeTitle,
	onBlurTitle,
	onBack,
	onTogglePin,
	onDelete,
}: Props) {
	const theme = useExtendedTheme();
	const insets = useSafeAreaInsets();
	const styles = useMemo(() => createStyles(theme), [theme]);

	return (
		<View style={[styles.headerShell, { paddingTop: insets.top + 8 }]}>
			<View style={styles.headerRow}>
				<View style={styles.headerBackRail}>
					<TouchableOpacity
						onPress={onBack}
						style={styles.headerBackButton}
						accessibilityRole="button"
						accessibilityLabel="Back"
					>
						<MaterialIcons
							name="arrow-back"
							size={24}
							color={theme.colors.text}
						/>
					</TouchableOpacity>
				</View>
				<View style={styles.headerTitleWrapper}>
					<TextInput
						style={styles.headerTitleInput}
						value={title}
						onChangeText={onChangeTitle}
						editable
						placeholder="Title"
						placeholderTextColor={theme.custom.editor.placeholder}
						onBlur={onBlurTitle}
						numberOfLines={1}
						accessibilityLabel="Title"
					/>
				</View>
				<SaveIndicator status={status} />
				<View style={[styles.headerSideRail, styles.headerActionsRail]}>
					<TouchableOpacity
						onPress={onTogglePin}
						style={styles.headerIconButton}
						disabled={noteType === "template"}
						accessibilityRole="button"
						accessibilityLabel="Pin note"
					>
						<MaterialIcons
							name="push-pin"
							size={24}
							color={
								noteType === "template"
									? theme.colors.textFaded
									: isPinned
										? theme.colors.primary
										: theme.colors.textMuted
							}
						/>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={onDelete}
						style={styles.headerIconButton}
						accessibilityRole="button"
						accessibilityLabel="Delete note"
					>
						<MaterialIcons
							name="delete"
							size={24}
							color={theme.colors.textMuted}
						/>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		headerShell: {
			paddingHorizontal: 16,
			paddingBottom: 8,
			backgroundColor: theme.colors.background,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		headerRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
		},
		headerBackRail: {
			flexDirection: "row",
			alignItems: "center",
		},
		headerSideRail: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			width: 132,
			minWidth: 132,
		},
		headerBackButton: {
			paddingVertical: 8,
			paddingRight: 4,
		},
		headerTitleWrapper: {
			flex: 1,
			minWidth: 0,
		},
		headerTitleInput: {
			fontSize: 18,
			fontWeight: "600",
			paddingVertical: 4,
			paddingHorizontal: 0,
			color: theme.colors.text,
			width: "100%",
			minWidth: 0,
			...webTextInputReset,
		},
		headerActionsRail: {
			justifyContent: "flex-end",
		},
		headerIconButton: {
			paddingVertical: 8,
			paddingHorizontal: 4,
		},
	});
}
