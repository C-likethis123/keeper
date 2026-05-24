import type { ExtendedTheme } from "@/constants/themes/types";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import React, { useState } from "react";
import {
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

const MIN = 1;
const MAX = 8;

function Stepper({
	label,
	value,
	onChange,
}: {
	label: string;
	value: number;
	onChange: (v: number) => void;
}) {
	const styles = useStyles(createStyles);
	const theme = useExtendedTheme();

	return (
		<View style={styles.stepperRow}>
			<Text style={styles.stepperLabel}>{label}</Text>
			<View style={styles.stepperControls}>
				<Pressable
					style={[styles.stepBtn, value <= MIN && styles.stepBtnDisabled]}
					onPress={() => onChange(Math.max(MIN, value - 1))}
					disabled={value <= MIN}
				>
					<FontAwesome
						name="minus"
						size={14}
						color={
							value <= MIN ? theme.colors.textDisabled : theme.colors.text
						}
					/>
				</Pressable>
				<Text style={styles.stepValue}>{value}</Text>
				<Pressable
					style={[styles.stepBtn, value >= MAX && styles.stepBtnDisabled]}
					onPress={() => onChange(Math.min(MAX, value + 1))}
					disabled={value >= MAX}
				>
					<FontAwesome
						name="plus"
						size={14}
						color={
							value >= MAX ? theme.colors.textDisabled : theme.colors.text
						}
					/>
				</Pressable>
			</View>
		</View>
	);
}

interface TableSizeModalProps {
	visible: boolean;
	onDismiss: () => void;
	onInsert: (rows: number, cols: number) => void;
}

export function TableSizeModal({
	visible,
	onDismiss,
	onInsert,
}: TableSizeModalProps) {
	const styles = useStyles(createStyles);
	const theme = useExtendedTheme();
	const [rows, setRows] = useState(3);
	const [cols, setCols] = useState(3);

	if (!visible) return null;

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={onDismiss}
		>
			<Pressable style={styles.backdrop} onPress={onDismiss}>
				<Pressable style={styles.card} onPress={() => {}}>
					<View style={styles.header}>
						<Text style={styles.title}>Insert Table</Text>
						<Pressable onPress={onDismiss} hitSlop={8}>
							<FontAwesome
								name="times"
								size={18}
								color={theme.colors.text}
							/>
						</Pressable>
					</View>

					<Stepper label="Rows" value={rows} onChange={setRows} />
					<Stepper label="Columns" value={cols} onChange={setCols} />

					<View style={styles.preview}>
						{Array.from({ length: Math.min(rows, 4) }, (_, ri) => (
							<View key={ri} style={styles.previewRow}>
								{Array.from({ length: Math.min(cols, 6) }, (_, ci) => (
									<View
										key={ci}
										style={[
											styles.previewCell,
											ri === 0 && styles.previewHeaderCell,
										]}
									/>
								))}
								{cols > 6 && (
									<Text style={styles.previewMore}>…</Text>
								)}
							</View>
						))}
						{rows > 4 && (
							<Text style={styles.previewMore}>…</Text>
						)}
					</View>

					<View style={styles.buttonRow}>
						<Pressable style={styles.cancelBtn} onPress={onDismiss}>
							<Text style={styles.cancelText}>Cancel</Text>
						</Pressable>
						<Pressable
							style={styles.insertBtn}
							onPress={() => {
								onInsert(rows, cols);
								setRows(3);
								setCols(3);
							}}
						>
							<Text style={styles.insertText}>Insert</Text>
						</Pressable>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		backdrop: {
			flex: 1,
			backgroundColor: "rgba(0,0,0,0.35)",
			justifyContent: "center",
			padding: 24,
		},
		card: {
			backgroundColor: theme.colors.background,
			borderRadius: 16,
			borderWidth: 1,
			borderColor: theme.colors.border,
			padding: 20,
			gap: 16,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		title: {
			fontSize: 18,
			fontWeight: "700",
			color: theme.colors.text,
		},
		stepperRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		stepperLabel: {
			fontSize: 15,
			color: theme.colors.text,
			fontWeight: "500",
		},
		stepperControls: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
		},
		stepBtn: {
			width: 34,
			height: 34,
			borderRadius: 17,
			borderWidth: 1,
			borderColor: theme.colors.border,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: theme.colors.card,
		},
		stepBtnDisabled: {
			opacity: 0.4,
		},
		stepValue: {
			fontSize: 16,
			fontWeight: "600",
			color: theme.colors.text,
			minWidth: 24,
			textAlign: "center",
		},
		preview: {
			gap: 2,
			alignSelf: "center",
		},
		previewRow: {
			flexDirection: "row",
			gap: 2,
		},
		previewCell: {
			width: 28,
			height: 18,
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 2,
			backgroundColor: theme.colors.card,
		},
		previewHeaderCell: {
			backgroundColor: theme.dark
				? "rgba(255,255,255,0.15)"
				: "rgba(0,0,0,0.10)",
		},
		previewMore: {
			color: theme.colors.textMuted,
			fontSize: 12,
			alignSelf: "center",
		},
		buttonRow: {
			flexDirection: "row",
			gap: 10,
		},
		cancelBtn: {
			flex: 1,
			paddingVertical: 11,
			borderRadius: 8,
			borderWidth: 1,
			borderColor: theme.colors.border,
			alignItems: "center",
		},
		cancelText: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.text,
		},
		insertBtn: {
			flex: 1,
			paddingVertical: 11,
			borderRadius: 8,
			backgroundColor: "#007AFF",
			alignItems: "center",
		},
		insertText: {
			fontSize: 14,
			fontWeight: "600",
			color: "#fff",
		},
	});
}
