import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type ResetAppDataModalProps = {
	visible: boolean;
	isResetting: boolean;
	onClose: () => void;
	onConfirm: () => void;
};

export default function ResetAppDataModal({
	visible,
	isResetting,
	onClose,
	onConfirm,
}: ResetAppDataModalProps) {
	const styles = useStyles(createStyles);

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={onClose}
		>
			<View style={styles.modalBackdrop}>
				<View style={styles.modalCard}>
					<Text style={styles.modalTitle}>Reset app data?</Text>
					<Text style={styles.modalMessage}>
						This clears local notes, attachments, search data, and stored app
						keys. Git-backed notes may sync back from remote afterward.
					</Text>
					<View style={styles.modalActions}>
						<Pressable
							accessibilityRole="button"
							style={styles.modalSecondaryButton}
							onPress={onClose}
							disabled={isResetting}
						>
							<Text style={styles.modalSecondaryButtonText}>Cancel</Text>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							style={styles.modalDestructiveButton}
							onPress={onConfirm}
							disabled={isResetting}
						>
							<Text style={styles.modalDestructiveButtonText}>Reset</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		modalBackdrop: {
			flex: 1,
			backgroundColor: "rgba(0, 0, 0, 0.35)",
			justifyContent: "center",
			padding: 20,
		},
		modalCard: {
			borderRadius: 16,
			padding: 20,
			backgroundColor: theme.colors.background,
			borderWidth: 1,
			borderColor: theme.colors.border,
			gap: 12,
		},
		modalTitle: {
			fontSize: 18,
			fontWeight: "700",
			color: theme.colors.text,
		},
		modalMessage: {
			fontSize: 14,
			lineHeight: 20,
			color: theme.colors.textMuted,
		},
		modalActions: {
			flexDirection: "row",
			justifyContent: "flex-end",
			gap: 12,
			marginTop: 4,
		},
		modalSecondaryButton: {
			paddingHorizontal: 14,
			paddingVertical: 10,
			borderRadius: 10,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
		},
		modalSecondaryButtonText: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.text,
		},
		modalDestructiveButton: {
			paddingHorizontal: 14,
			paddingVertical: 10,
			borderRadius: 10,
			backgroundColor: theme.colors.error,
		},
		modalDestructiveButtonText: {
			fontSize: 14,
			fontWeight: "700",
			color: theme.colors.card,
		},
	});
}
