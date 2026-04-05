import { SaveIndicator, type SaveStatus } from "@/components/SaveIndicator";
import { webTextInputReset } from "@/components/shared/textInputWebStyles";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { Note } from "@/services/notes/types";
import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
	title: string;
	status: SaveStatus;
	isPinned: boolean;
	noteType: Note["noteType"];
	onChangeTitle: (value: string) => void;
	onBlurTitle: () => void;
	onSubmitEditing: () => void;
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
	onSubmitEditing,
	onBack,
	onTogglePin,
	onDelete,
}: Props) {
	const theme = useExtendedTheme();
	const insets = useSafeAreaInsets();
	const styles = useStyles(createStyles);

	return (
		<View style={[styles.headerShell, { paddingTop: insets.top + 8 }]}>
			<View style={styles.headerRow}>
				<View style={styles.headerBackRail}>
					<Pressable
						onPress={onBack}
						style={styles.headerBackButton}
						accessibilityRole="button"
						accessibilityLabel="Back"
					>
						<FontAwesome
							name="arrow-left"
							size={24}
							style={styles.backIcon}
						/>
					</Pressable>
				</View>
				<View style={styles.headerTitleWrapper}>
					<TextInput
						style={styles.headerTitleInput}
						value={title}
						onChangeText={onChangeTitle}
						editable
						autoCapitalize="none"
						autoCorrect={false}
						spellCheck={false}
						autoComplete="off"
						placeholder="Title"
						placeholderTextColor={theme.custom.editor.placeholder}
						onBlur={onBlurTitle}
						onSubmitEditing={onSubmitEditing}
						returnKeyType="next"
						numberOfLines={1}
						accessibilityLabel="Title"
					/>
				</View>
				<SaveIndicator status={status} />
				<View style={[styles.headerSideRail, styles.headerActionsRail]}>
					<Pressable
						onPress={onTogglePin}
						style={styles.headerIconButton}
						disabled={noteType === "template"}
						accessibilityRole="button"
						accessibilityLabel="Pin note"
					>
						<FontAwesome
							name="thumb-tack"
							size={24}
							style={[
								styles.pinIcon,
								noteType === "template"
									? styles.pinIconTemplate
									: isPinned
										? styles.pinIconPinned
										: null,
							]}
						/>
					</Pressable>
					<Pressable
						onPress={onDelete}
						style={styles.headerIconButton}
						accessibilityRole="button"
						accessibilityLabel="Delete note"
					>
						<FontAwesome
							name="trash"
							size={24}
							style={styles.deleteIcon}
						/>
					</Pressable>
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
		backIcon: {
			color: theme.colors.text,
		},
		pinIcon: {
			color: theme.colors.textMuted,
		},
		pinIconPinned: {
			color: theme.colors.primary,
		},
		pinIconTemplate: {
			color: theme.colors.textFaded,
		},
		deleteIcon: {
			color: theme.colors.textMuted,
		},
	});
}
