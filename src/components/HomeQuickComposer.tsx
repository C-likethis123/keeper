import { IconButton } from "@/components/shared/IconButton";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { NoteType } from "@/services/notes/types";
import { FontAwesome } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	type TextInput as TextInputType,
	View,
} from "react-native";

export default function HomeQuickComposer({
	onCreateTypedNote,
	onSave,
}: {
	onCreateTypedNote: (props?: {
		noteType?: NoteType;
		title?: string;
	}) => void;
	onSave: (draft: {
		title: string;
		content: string;
		isPinned: boolean;
	}) => Promise<void>;
}) {
	const styles = useStyles(createStyles);
	const [isExpanded, setIsExpanded] = useState(false);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [isPinned, setIsPinned] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const contentInputRef = useRef<TextInputType>(null);

	const expand = () => {
		setIsExpanded(true);
	};

	const close = async () => {
		if (isSaving) return;
		if (title.trim() || content.trim()) {
			setIsSaving(true);
			try {
				await onSave({ title: title.trim(), content, isPinned });
			} catch {
				return;
			} finally {
				setIsSaving(false);
			}
		}
		setTitle("");
		setContent("");
		setIsPinned(false);
		setIsExpanded(false);
	};

	return (
		<View style={styles.wrapper}>
			<View
				testID="home-quick-composer-card"
				style={[styles.card, isExpanded && styles.cardExpanded]}
			>
				{isExpanded ? (
					<>
						<TextInput
							autoFocus
							accessibilityLabel="Note title"
							placeholder="Title"
							placeholderTextColor={styles.placeholder.color}
							value={title}
							onChangeText={setTitle}
							onSubmitEditing={() => contentInputRef.current?.focus()}
							returnKeyType="next"
							blurOnSubmit={false}
							style={styles.titleInput}
						/>
						<TextInput
							ref={contentInputRef}
							accessibilityLabel="Note content"
							placeholder="Take a note..."
							placeholderTextColor={styles.placeholder.color}
							value={content}
							onChangeText={setContent}
							multiline
							textAlignVertical="top"
							style={styles.contentInput}
						/>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={isPinned ? "Unpin note" : "Pin note"}
							accessibilityState={{ selected: isPinned }}
							onPress={() => setIsPinned((current) => !current)}
							style={styles.pinButton}
						>
							<FontAwesome
								name="thumb-tack"
								size={20}
								color={
									isPinned ? styles.pinIconPinned.color : styles.pinIcon.color
								}
							/>
						</Pressable>
						<View style={styles.expandedFooter}>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="Close note"
								disabled={isSaving}
								onPress={() => void close()}
								style={({ pressed }) => [
									styles.closeButton,
									pressed && styles.primaryActionPressed,
								]}
							>
								<Text style={styles.closeButtonText}>
									{isSaving ? "Saving..." : "Close"}
								</Text>
							</Pressable>
						</View>
					</>
				) : (
					<>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Take a note"
							style={({ pressed }) => [
								styles.primaryAction,
								pressed && styles.primaryActionPressed,
							]}
							onPress={expand}
						>
							<Text style={styles.placeholder}>Take a note...</Text>
						</Pressable>
						<View style={styles.actions}>
							<IconButton
								label="Create todo"
								name="check-square-o"
								variant="flat"
								onPress={() =>
									onCreateTypedNote({ noteType: "todo", title: "TODO:" })
								}
							/>
							<IconButton
								label="Create journal"
								name="pencil"
								variant="flat"
								onPress={() =>
									onCreateTypedNote({
										noteType: "journal",
										title: "Journal: ",
									})
								}
							/>
							<IconButton
								label="Create resource"
								name="bookmark-o"
								variant="flat"
								onPress={() =>
									onCreateTypedNote({
										noteType: "resource",
										title: "Source: ",
									})
								}
							/>
							<IconButton
								label="Create drawing"
								name="paint-brush"
								variant="flat"
								onPress={() => onCreateTypedNote({ noteType: "drawing" })}
							/>
						</View>
					</>
				)}
			</View>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		wrapper: {
			paddingTop: 12,
			paddingBottom: 16,
			paddingHorizontal: 8,
		},
		card: {
			maxWidth: 640,
			width: "100%",
			alignSelf: "center",
			minHeight: 60,
			paddingHorizontal: 18,
			paddingVertical: 14,
			borderRadius: 16,
			backgroundColor: theme.colors.card,
			borderWidth: 1,
			borderColor: theme.colors.border,
			flexDirection: "row",
			alignItems: "center",
			shadowColor: theme.colors.shadow,
			shadowOpacity: 0.12,
			shadowRadius: 10,
			shadowOffset: { width: 0, height: 4 },
			elevation: 3,
		},
		cardExpanded: {
			maxWidth: 860,
			minHeight: 220,
			paddingTop: 14,
			paddingBottom: 10,
			flexDirection: "column",
			alignItems: "stretch",
			borderRadius: 12,
		},
		primaryAction: {
			flex: 1,
		},
		primaryActionPressed: {
			opacity: 0.7,
		},
		placeholder: {
			flex: 1,
			fontSize: 20,
			color: theme.colors.textMuted,
		},
		titleInput: {
			minHeight: 44,
			paddingRight: 44,
			fontSize: 18,
			fontWeight: "600",
			color: theme.colors.text,
		},
		contentInput: {
			minHeight: 104,
			paddingTop: 8,
			paddingBottom: 8,
			fontSize: 16,
			lineHeight: 22,
			color: theme.colors.text,
		},
		pinButton: {
			position: "absolute",
			top: 8,
			right: 10,
			width: 40,
			height: 40,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: 20,
		},
		pinIcon: {
			color: theme.colors.textMuted,
		},
		pinIconPinned: {
			color: theme.colors.primary,
		},
		expandedFooter: {
			minHeight: 40,
			alignItems: "flex-end",
			justifyContent: "center",
		},
		closeButton: {
			paddingHorizontal: 16,
			paddingVertical: 9,
			borderRadius: 8,
		},
		closeButtonText: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.text,
		},
		actions: {
			flexDirection: "row",
			alignItems: "center",
			gap: 16,
			marginLeft: 16,
		},
	});
}
