import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { useState } from "react";
import {
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

type RenameClusterModalProps = {
	visible: boolean;
	initialName: string;
	onClose: () => void;
	onConfirm: (newName: string) => void;
	onRename?: (newName: string) => void;
};

export default function RenameClusterModal({
	visible,
	initialName,
	onClose,
	onConfirm,
	onRename,
}: RenameClusterModalProps) {
	const styles = useStyles(createStyles);
	const [name, setName] = useState(initialName);

	const handleConfirm = () => {
		const trimmed = name.trim();
		if (trimmed) {
			onConfirm(trimmed);
			onRename?.(trimmed);
		}
	};

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={onClose}
			onShow={() => setName(initialName)}
		>
			<View style={styles.backdrop}>
				<View style={styles.card}>
					<Text style={styles.title}>Rename Cluster</Text>
					<TextInput
						style={styles.input}
						value={name}
						onChangeText={setName}
						autoFocus
						selectTextOnFocus
						returnKeyType="done"
						onSubmitEditing={handleConfirm}
					/>
					<View style={styles.actions}>
						<Pressable
							accessibilityRole="button"
							style={styles.cancelButton}
							onPress={onClose}
						>
							<Text style={styles.cancelText}>Cancel</Text>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							style={styles.confirmButton}
							onPress={handleConfirm}
							disabled={!name.trim()}
						>
							<Text style={styles.confirmText}>Rename</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		backdrop: {
			flex: 1,
			backgroundColor: "rgba(0, 0, 0, 0.35)",
			justifyContent: "center",
			padding: 20,
		},
		card: {
			borderRadius: 16,
			padding: 20,
			backgroundColor: theme.colors.background,
			borderWidth: 1,
			borderColor: theme.colors.border,
			gap: 12,
		},
		title: {
			fontSize: 18,
			fontWeight: "700",
			color: theme.colors.text,
		},
		input: {
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 8,
			paddingHorizontal: 12,
			paddingVertical: 10,
			fontSize: 15,
			color: theme.colors.text,
			backgroundColor: theme.colors.card,
		},
		actions: {
			flexDirection: "row",
			justifyContent: "flex-end",
			gap: 12,
			marginTop: 4,
		},
		cancelButton: {
			paddingHorizontal: 14,
			paddingVertical: 10,
			borderRadius: 10,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
		},
		cancelText: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.text,
		},
		confirmButton: {
			paddingHorizontal: 14,
			paddingVertical: 10,
			borderRadius: 10,
			backgroundColor: theme.colors.primary,
		},
		confirmText: {
			fontSize: 14,
			fontWeight: "700",
			color: theme.colors.card,
		},
	});
}
