import { Dialog } from "@/components/shared/Dialog";
import type React from "react";
import "@/components/shared/shared.css";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { ClusterRow } from "@/services/notes/clusterService";
import { useState } from "react";

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
		<Dialog
			label="Merge Cluster Modal"
			open={visible}
			onDismiss={onClose}
			onOpen={handleShow}
		>
			<div className="keeper-layout" style={styles.backdrop}>
				<div className="keeper-layout" style={styles.card}>
					<span className="keeper-copy" style={styles.title}>
						Merge into existing MOC
					</span>

					<span className="keeper-copy" style={styles.sectionLabel}>
						Select MOC
					</span>
					<div
						className="keeper-layout"
						style={{ overflowY: "auto", ...styles.list }}
					>
						<div className="keeper-layout" style={{ ...styles.listContent }}>
							{acceptedClusters.length === 0 ? (
								<span className="keeper-copy" style={styles.emptyText}>
									No accepted MOCs yet.
								</span>
							) : (
								acceptedClusters.map((cluster) => {
									const selected = targetId === cluster.id;
									return (
										<label
											className="keeper-control"
											key={cluster.id}
											style={{
												...styles.row,
												...(selected ? styles.rowSelected : {}),
											}}
										>
											<input
												type="radio"
												name="merge-target"
												checked={selected}
												onChange={() => setTargetId(cluster.id)}
												style={{
													width: 16,
													height: 16,
													margin: 0,
													accentColor: colors.primary,
												}}
											/>
											<span
												className="keeper-copy"
												style={{
													...styles.rowText,
													overflow: "hidden",
													display: "-webkit-box",
													WebkitBoxOrient: "vertical",
													WebkitLineClamp: 1,
												}}
											>
												{cluster.name}
											</span>
										</label>
									);
								})
							)}
						</div>
					</div>

					<div className="keeper-layout" style={styles.sectionHeader}>
						<span className="keeper-copy" style={styles.sectionLabel}>
							Notes to merge
						</span>
						<button
							type="button"
							className="keeper-control"
							onClick={toggleSelectAll}
						>
							<span className="keeper-copy" style={styles.selectAllText}>
								{allSelected ? "Deselect all" : "Select all"}
							</span>
						</button>
					</div>
					<div
						className="keeper-layout"
						style={{ overflowY: "auto", ...styles.list }}
					>
						<div className="keeper-layout" style={{ ...styles.listContent }}>
							{memberNoteIds.map((id) => {
								const checked = selectedIds.has(id);
								return (
									<label
										className="keeper-control"
										key={id}
										style={{
											...styles.row,
											...(checked ? styles.rowSelected : {}),
										}}
									>
										<input
											type="checkbox"
											checked={checked}
											onChange={() => toggleNote(id)}
											style={{
												width: 16,
												height: 16,
												margin: 0,
												accentColor: colors.primary,
											}}
										/>
										<span
											className="keeper-copy"
											style={{
												...styles.rowText,
												overflow: "hidden",
												display: "-webkit-box",
												WebkitBoxOrient: "vertical",
												WebkitLineClamp: 1,
											}}
										>
											{memberNoteTitles.get(id) ?? id}
										</span>
									</label>
								);
							})}
						</div>
					</div>

					<div className="keeper-layout" style={styles.actions}>
						<button
							type="button"
							className="keeper-control"
							style={styles.cancelButton}
							onClick={onClose}
						>
							<span className="keeper-copy" style={styles.cancelText}>
								Cancel
							</span>
						</button>
						<button
							type="button"
							className="keeper-control"
							style={{
								...styles.confirmButton,
								...(!canConfirm ? styles.confirmButtonDisabled : {}),
							}}
							onClick={handleConfirm}
							disabled={!canConfirm}
						>
							<span className="keeper-copy" style={styles.confirmText}>
								Merge
							</span>
						</button>
					</div>
				</div>
			</div>
		</Dialog>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return {
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
		title: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
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
		listContent: { gap: 2, padding: 6 },
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			paddingTop: 8,
			paddingBottom: 8,
			paddingLeft: 10,
			paddingRight: 10,
			borderRadius: 8,
		},
		rowSelected: { backgroundColor: `${theme.colors.primary}18` },
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
			lineHeight: "12px",
		},
		rowText: { flex: 1, fontSize: 14, color: theme.colors.text },
		emptyText: {
			fontSize: 13,
			color: theme.colors.textSecondary,
			textAlign: "center",
			paddingTop: 12,
			paddingBottom: 12,
		},
		actions: {
			flexDirection: "row",
			justifyContent: "flex-end",
			gap: 12,
			marginTop: 4,
		},
		cancelButton: {
			paddingLeft: 14,
			paddingRight: 14,
			paddingTop: 10,
			paddingBottom: 10,
			borderRadius: 10,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
		},
		cancelText: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
		confirmButton: {
			paddingLeft: 14,
			paddingRight: 14,
			paddingTop: 10,
			paddingBottom: 10,
			borderRadius: 10,
			backgroundColor: theme.colors.primary,
		},
		confirmButtonDisabled: { opacity: 0.4 },
		confirmText: { fontSize: 14, fontWeight: "700", color: theme.colors.card },
	} satisfies Record<string, React.CSSProperties>;
}
