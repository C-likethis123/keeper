import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { ClusterRow } from "@/services/notes/clusterService";
import { useState } from "react";
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";

type MergeClusterModalProps = {
	visible: boolean;
	memberNoteIds: string[];
	memberNoteTitles: Map<string, string>;
	acceptedClusters: ClusterRow[];
	onClose: () => void;
	onConfirm: (targetClusterId: string, selectedNoteIds: string[]) => void;
};

export default function MergeClusterModal({
	visible,
	memberNoteIds,
	memberNoteTitles,
	acceptedClusters,
	onClose,
	onConfirm,
}: MergeClusterModalProps) {
	const styles = useStyles(createStyles);
	const { colors } = useExtendedTheme();
	const [targetId, setTargetId] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(
		new Set(memberNoteIds),
	);

	const allSelected = selectedIds.size === memberNoteIds.length;

	const handleShow = () => {
		setTargetId(null);
		setSelectedIds(new Set(memberNoteIds));
	};

	const toggleSelectAll = () => {
		setSelectedIds(allSelected ? new Set() : new Set(memberNoteIds));
	};

	const toggleNote = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	};

	const handleConfirm = () => {
		if (!targetId || selectedIds.size === 0) return;
		onConfirm(targetId, [...selectedIds]);
	};

	const canConfirm = targetId !== null && selectedIds.size > 0;

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={onClose}
			onShow={handleShow}
		>
			<View style={styles.backdrop}>
				<View style={styles.card}>
					<Text style={styles.title}>Merge into existing MOC</Text>

					<Text style={styles.sectionLabel}>Select MOC</Text>
					<ScrollView
						style={styles.list}
						contentContainerStyle={styles.listContent}
					>
						{acceptedClusters.length === 0 ? (
							<Text style={styles.emptyText}>No accepted MOCs yet.</Text>
						) : (
							acceptedClusters.map((cluster) => {
								const selected = targetId === cluster.id;
								return (
									<Pressable
										key={cluster.id}
										accessibilityRole="radio"
										style={[styles.row, selected && styles.rowSelected]}
										onPress={() => setTargetId(cluster.id)}
									>
										<View
											style={[
												styles.radio,
												selected && {
													backgroundColor: colors.primary,
													borderColor: colors.primary,
												},
											]}
										/>
										<Text style={styles.rowText} numberOfLines={1}>
											{cluster.name}
										</Text>
									</Pressable>
								);
							})
						)}
					</ScrollView>

					<View style={styles.sectionHeader}>
						<Text style={styles.sectionLabel}>Notes to merge</Text>
						<Pressable onPress={toggleSelectAll} accessibilityRole="button">
							<Text style={styles.selectAllText}>
								{allSelected ? "Deselect all" : "Select all"}
							</Text>
						</Pressable>
					</View>
					<ScrollView
						style={styles.list}
						contentContainerStyle={styles.listContent}
					>
						{memberNoteIds.map((id) => {
							const checked = selectedIds.has(id);
							return (
								<Pressable
									key={id}
									accessibilityRole="checkbox"
									style={[styles.row, checked && styles.rowSelected]}
									onPress={() => toggleNote(id)}
								>
									<View
										style={[
											styles.checkbox,
											checked && {
												backgroundColor: colors.primary,
												borderColor: colors.primary,
											},
										]}
									>
										{checked && (
											<Text style={styles.checkmark}>✓</Text>
										)}
									</View>
									<Text style={styles.rowText} numberOfLines={1}>
										{memberNoteTitles.get(id) ?? id}
									</Text>
								</Pressable>
							);
						})}
					</ScrollView>

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
							style={[
								styles.confirmButton,
								!canConfirm && styles.confirmButtonDisabled,
							]}
							onPress={handleConfirm}
							disabled={!canConfirm}
						>
							<Text style={styles.confirmText}>Merge</Text>
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
			gap: 10,
			maxHeight: "80%",
		},
		title: {
			fontSize: 18,
			fontWeight: "700",
			color: theme.colors.text,
		},
		sectionHeader: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
		},
		sectionLabel: {
			fontSize: 13,
			fontWeight: "600",
			color: theme.colors.textSecondary,
			textTransform: "uppercase",
			letterSpacing: 0.4,
		},
		selectAllText: {
			fontSize: 13,
			fontWeight: "500",
			color: theme.colors.primary,
		},
		list: {
			maxHeight: 160,
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 10,
		},
		listContent: {
			gap: 2,
			padding: 6,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			paddingVertical: 8,
			paddingHorizontal: 10,
			borderRadius: 8,
		},
		rowSelected: {
			backgroundColor: `${theme.colors.primary}18`,
		},
		radio: {
			width: 16,
			height: 16,
			borderRadius: 8,
			borderWidth: 2,
			borderColor: theme.colors.border,
		},
		checkbox: {
			width: 16,
			height: 16,
			borderRadius: 4,
			borderWidth: 2,
			borderColor: theme.colors.border,
			alignItems: "center",
			justifyContent: "center",
		},
		checkmark: {
			fontSize: 10,
			color: "#fff",
			fontWeight: "700",
			lineHeight: 12,
		},
		rowText: {
			flex: 1,
			fontSize: 14,
			color: theme.colors.text,
		},
		emptyText: {
			fontSize: 13,
			color: theme.colors.textSecondary,
			textAlign: "center",
			paddingVertical: 12,
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
		confirmButtonDisabled: {
			opacity: 0.4,
		},
		confirmText: {
			fontSize: 14,
			fontWeight: "700",
			color: theme.colors.card,
		},
	});
}
