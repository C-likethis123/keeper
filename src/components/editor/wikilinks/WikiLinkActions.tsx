import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useCallback } from "react";
import {
	Modal,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useWikiLinkContext } from "./WikiLinkContext";

interface WikiLinkActionsProps {
	onOpenWikiLink: (title: string) => void | Promise<void>;
}

export function WikiLinkActions({ onOpenWikiLink }: WikiLinkActionsProps) {
	const styles = useStyles(createStyles);
	const { actionsWikiLink, hideActions } = useWikiLinkContext();

	const handleOpen = useCallback(async () => {
		if (actionsWikiLink) {
			const title = actionsWikiLink.title;
			hideActions();
			await onOpenWikiLink(title);
		}
	}, [actionsWikiLink, hideActions, onOpenWikiLink]);

	const handleCopy = useCallback(async () => {
		if (actionsWikiLink) {
			await Clipboard.setStringAsync(actionsWikiLink.title);
			hideActions();
		}
	}, [actionsWikiLink, hideActions]);

	if (!actionsWikiLink) return null;

	return (
		<Modal
			visible={!!actionsWikiLink}
			transparent
			animationType="slide"
			onRequestClose={hideActions}
		>
			<Pressable style={styles.backdrop} onPress={hideActions}>
				<View style={styles.container}>
					<View style={styles.drawer}>
						<View style={styles.header}>
							<Text style={styles.title} numberOfLines={1}>
								[[{actionsWikiLink.title}]]
							</Text>
							<Pressable onPress={hideActions} style={styles.closeButton}>
								<FontAwesome
									name="close"
									size={24}
									style={styles.closeButton}
								/>
							</Pressable>
						</View>

						<Pressable style={styles.actionItem} onPress={handleOpen}>
							<FontAwesome
								name="external-link"
								size={22}
								style={styles.actionIcon}
							/>
							<Text style={styles.actionText}>Open Note</Text>
						</Pressable>

						<Pressable style={styles.actionItem} onPress={handleCopy}>
							<FontAwesome name="copy" size={22} color={styles.actionIcon} />
							<Text style={styles.actionText}>Copy Title</Text>
						</Pressable>

						<View style={styles.footer}>
							<Pressable style={styles.cancelButton} onPress={hideActions}>
								<Text style={styles.cancelText}>Cancel</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Pressable>
		</Modal>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		backdrop: {
			flex: 1,
			backgroundColor: "rgba(0,0,0,0.4)",
			justifyContent: "flex-end",
		},
		container: {
			width: "100%",
			alignItems: "center",
		},
		drawer: {
			width: "100%",
			maxWidth: Platform.OS === "web" ? 500 : "100%",
			backgroundColor: theme.colors.background,
			borderTopLeftRadius: 20,
			borderTopRightRadius: 20,
			paddingBottom: Platform.OS === "ios" ? 40 : 20,
			paddingTop: 12,
			shadowColor: "#000",
			shadowOffset: { width: 0, height: -4 },
			shadowOpacity: 0.1,
			shadowRadius: 10,
			elevation: 20,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: 20,
			paddingVertical: 12,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.colors.border,
			marginBottom: 8,
		},
		title: {
			fontSize: 17,
			fontWeight: "700",
			color: theme.colors.text,
			flex: 1,
			marginRight: 10,
		},
		closeButton: {
			padding: 4,
			color: theme.colors.textMuted,
		},
		actionItem: {
			flexDirection: "row",
			alignItems: "center",
			paddingHorizontal: 20,
			paddingVertical: 16,
			gap: 12,
		},
		actionIcon: {
			color: theme.colors.primary,
		},
		actionText: {
			fontSize: 16,
			color: theme.colors.text,
		},
		footer: {
			marginTop: 8,
			paddingHorizontal: 20,
		},
		cancelButton: {
			height: 50,
			borderRadius: 12,
			backgroundColor: theme.colors.card,
			justifyContent: "center",
			alignItems: "center",
			borderWidth: 1,
			borderColor: theme.colors.border,
		},
		cancelText: {
			fontSize: 16,
			fontWeight: "600",
			color: theme.colors.text,
		},
	});
}
