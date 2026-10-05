import type React from "react";
import "@/components/shared/shared.css";
import MergeClusterModal from "@/components/moc/MergeClusterModal";
import RenameClusterModal from "@/components/moc/RenameClusterModal";
import EmptyState from "@/components/shared/EmptyState";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { logFeedback } from "@/services/notes/clusterFeedbackService";
import {
	type ClusterRow,
	clusterAccept,
	clusterAddNote,
	clusterDismiss,
	clusterRename,
	listAcceptedClusters,
	listActiveClusters,
	listClusterMembers,
} from "@/services/notes/clusterService";
import { notesIndexDbGetById } from "@/services/notes/notesIndexDb";
import { useStorageStore } from "@/stores/storageStore";
import { useCallback, useEffect, useState } from "react";

interface ClusterCard {
	cluster: ClusterRow;
	memberNoteIds: string[];
	memberNoteTitles: Map<string, string>;
}

export default function MOCSuggestions({
	variant = "inline",
	onPressViewAll,
}: {
	variant?: "inline" | "screen";
	onPressViewAll?: () => void;
}) {
	const { colors } = useExtendedTheme();
	const contentVersion = useStorageStore((s) => s.contentVersion);
	const bumpContentVersion = useStorageStore((s) => s.bumpContentVersion);
	const [cards, setCards] = useState<ClusterCard[]>([]);
	const [acceptedClusters, setAcceptedClusters] = useState<ClusterRow[]>([]);
	const [renameCard, setRenameCard] = useState<ClusterCard | null>(null);
	const [mergeCard, setMergeCard] = useState<ClusterCard | null>(null);

	const loadClusters = useCallback(async () => {
		const [clusters, accepted] = await Promise.all([
			listActiveClusters(),
			listAcceptedClusters(),
		]);
		setAcceptedClusters(accepted);

		const loaded: ClusterCard[] = await Promise.all(
			clusters.map(async (cluster) => {
				const members = await listClusterMembers(cluster.id);
				const memberIds = members.map((m) => m.note_id);

				const memberTitles = new Map<string, string>();
				for (const id of memberIds) {
					const note = await notesIndexDbGetById(id);
					memberTitles.set(id, note?.title ?? id);
				}

				return {
					cluster,
					memberNoteIds: memberIds,
					memberNoteTitles: memberTitles,
				};
			}),
		);
		setCards(loaded);
	}, []);

	useEffect(() => {
		void contentVersion;
		void loadClusters();
	}, [loadClusters, contentVersion]);

	const handleDismiss = useCallback(
		async (card: ClusterCard) => {
			await clusterDismiss(card.cluster.id);
			logFeedback(card.cluster.id, "dismiss", {
				originalName: card.cluster.name,
				confidence: card.cluster.confidence,
				memberCount: card.memberNoteIds.length,
			}).catch((e) =>
				console.warn("[MOCSuggestions] logFeedback dismiss failed:", e),
			);
			bumpContentVersion();
			await loadClusters();
		},
		[loadClusters, bumpContentVersion],
	);

	const handleAccept = useCallback(
		async (card: ClusterCard) => {
			await clusterAccept(card.cluster.id);
			logFeedback(card.cluster.id, "accept", {
				originalName: card.cluster.name,
				confidence: card.cluster.confidence,
				memberCount: card.memberNoteIds.length,
				memberIds: card.memberNoteIds,
			}).catch((e) =>
				console.warn("[MOCSuggestions] logFeedback accept failed:", e),
			);
			bumpContentVersion();
			await loadClusters();
		},
		[loadClusters, bumpContentVersion],
	);

	const handleRename = useCallback((card: ClusterCard) => {
		setRenameCard(card);
	}, []);

	const handleRenameConfirm = useCallback(
		async (newName: string) => {
			if (!renameCard) return;
			await clusterRename(renameCard.cluster.id, newName);
			logFeedback(renameCard.cluster.id, "rename", {
				originalName: renameCard.cluster.name,
				newName,
			}).catch((e) =>
				console.warn("[MOCSuggestions] logFeedback rename failed:", e),
			);
			setRenameCard(null);
			await loadClusters();
		},
		[renameCard, loadClusters],
	);

	const handleMerge = useCallback((card: ClusterCard) => {
		setMergeCard(card);
	}, []);

	const handleMergeConfirm = useCallback(
		async (targetClusterId: string, selectedNoteIds: string[]) => {
			if (!mergeCard) return;
			await Promise.all(
				selectedNoteIds.map((id) => clusterAddNote(targetClusterId, id)),
			);
			await clusterDismiss(mergeCard.cluster.id);
			logFeedback(mergeCard.cluster.id, "merge", {
				originalName: mergeCard.cluster.name,
				targetClusterId,
				mergedNoteIds: selectedNoteIds,
				confidence: mergeCard.cluster.confidence,
			}).catch((e) =>
				console.warn("[MOCSuggestions] logFeedback merge failed:", e),
			);
			setMergeCard(null);
			bumpContentVersion();
			await loadClusters();
		},
		[mergeCard, loadClusters, bumpContentVersion],
	);

	if (cards.length === 0) {
		if (variant === "inline") {
			return null;
		}
		return (
			<div className="keeper-layout" style={styles.screenEmptyState}>
				<EmptyState
					title="No suggested MOCs"
					subtitle="New note clusters will appear here after the suggestion pipeline has generated them."
				/>
			</div>
		);
	}

	const content = (
		<div
			className="keeper-layout"
			style={{
				...styles.container,
				...(variant === "screen" ? styles.screenContainer : null),
			}}
		>
			<div className="keeper-layout" style={styles.sectionHeaderRow}>
				<span
					className="keeper-copy"
					style={{ ...styles.sectionHeader, ...{ color: colors.text } }}
				>
					Suggested MOCs
				</span>
				{variant === "inline" && onPressViewAll ? (
					<button
						type="button"
						className="keeper-control"
						aria-label="View all suggested MOCs"
						onClick={onPressViewAll}
					>
						<span
							className="keeper-copy"
							style={{ ...styles.viewAllText, ...{ color: colors.primary } }}
						>
							View all
						</span>
					</button>
				) : null}
			</div>
			{cards.map((card) => (
				<div
					className="keeper-layout"
					key={card.cluster.id}
					style={{
						...styles.card,
						...{ backgroundColor: colors.card, borderColor: colors.border },
					}}
				>
					<span
						className="keeper-copy"
						style={{
							...{ ...styles.clusterName, ...{ color: colors.text } },
							overflow: "hidden",
							display: "-webkit-box",
							WebkitBoxOrient: "vertical",
							WebkitLineClamp: 1,
						}}
					>
						{card.cluster.name}
					</span>
					<span
						className="keeper-copy"
						style={{
							...{ ...styles.members, ...{ color: colors.textSecondary } },
							overflow: "hidden",
							display: "-webkit-box",
							WebkitBoxOrient: "vertical",
							WebkitLineClamp: 2,
						}}
					>
						{card.memberNoteIds
							.slice(0, 5)
							.map((id) => card.memberNoteTitles.get(id) || id)
							.join(" · ")}
					</span>
					<span
						className="keeper-copy"
						style={{ ...styles.confidence, ...{ color: colors.textSecondary } }}
					>
						{Math.round(card.cluster.confidence * 100)}% confidence
					</span>
					<div className="keeper-layout" style={styles.actions}>
						<button
							type="button"
							className="keeper-control"
							onClick={() => handleAccept(card)}
							style={{
								...styles.actionBtn,
								...{ backgroundColor: colors.primary },
							}}
						>
							<span
								className="keeper-copy"
								style={{
									...styles.actionBtnText,
									...{ color: colors.primaryContrast },
								}}
							>
								Accept
							</span>
						</button>
						<button
							type="button"
							className="keeper-control"
							onClick={() => handleRename(card)}
							style={{
								...styles.actionBtn,
								...{
									backgroundColor: colors.card,
									borderWidth: 1,
									borderColor: colors.border,
								},
							}}
						>
							<span
								className="keeper-copy"
								style={{ ...styles.actionBtnText, ...{ color: colors.text } }}
							>
								Rename
							</span>
						</button>
						<button
							type="button"
							className="keeper-control"
							onClick={() => handleMerge(card)}
							style={{
								...styles.actionBtn,
								...{
									backgroundColor: colors.card,
									borderWidth: 1,
									borderColor: colors.border,
								},
							}}
						>
							<span
								className="keeper-copy"
								style={{ ...styles.actionBtnText, ...{ color: colors.text } }}
							>
								Merge
							</span>
						</button>
						<button
							type="button"
							className="keeper-control"
							onClick={() => handleDismiss(card)}
							style={{
								...styles.actionBtn,
								...{
									backgroundColor: colors.card,
									borderWidth: 1,
									borderColor: colors.border,
								},
							}}
						>
							<span
								className="keeper-copy"
								style={{
									...styles.actionBtnText,
									...{ color: colors.textSecondary },
								}}
							>
								Dismiss
							</span>
						</button>
					</div>
				</div>
			))}
		</div>
	);

	if (variant === "screen") {
		return (
			<div className="keeper-layout" style={styles.screenRoot}>
				<RenameClusterModal
					visible={renameCard !== null}
					initialName={renameCard?.cluster.name ?? ""}
					onClose={() => setRenameCard(null)}
					onConfirm={handleRenameConfirm}
				/>
				<MergeClusterModal
					visible={mergeCard !== null}
					memberNoteIds={mergeCard?.memberNoteIds ?? []}
					memberNoteTitles={mergeCard?.memberNoteTitles ?? new Map()}
					acceptedClusters={acceptedClusters}
					onClose={() => setMergeCard(null)}
					onConfirm={handleMergeConfirm}
				/>
				<div className="keeper-layout" style={{ overflowY: "auto", ...{} }}>
					<div
						className="keeper-layout"
						style={{ ...styles.screenScrollContent }}
					>
						{content}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="keeper-layout">
			<RenameClusterModal
				visible={renameCard !== null}
				initialName={renameCard?.cluster.name ?? ""}
				onClose={() => setRenameCard(null)}
				onConfirm={handleRenameConfirm}
			/>
			<MergeClusterModal
				visible={mergeCard !== null}
				memberNoteIds={mergeCard?.memberNoteIds ?? []}
				memberNoteTitles={mergeCard?.memberNoteTitles ?? new Map()}
				acceptedClusters={acceptedClusters}
				onClose={() => setMergeCard(null)}
				onConfirm={handleMergeConfirm}
			/>
			{content}
		</div>
	);
}

const styles = {
	container: { paddingLeft: 4, paddingRight: 4, paddingTop: 12, gap: 12 },
	screenRoot: { flex: 1 },
	screenContainer: {
		width: "100%",
		maxWidth: 760,
		alignSelf: "center",
		paddingLeft: 16,
		paddingRight: 16,
		paddingTop: 20,
		paddingBottom: 32,
	},
	screenScrollContent: { paddingBottom: 32 },
	screenEmptyState: { flex: 1 },
	sectionHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	sectionHeader: {
		fontSize: 13,
		fontWeight: "600",
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 4,
	},
	viewAllText: { fontSize: 13, fontWeight: "600" },
	card: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 6 },
	clusterName: { fontSize: 16, fontWeight: "600" },
	members: { fontSize: 13 },
	confidence: { fontSize: 12 },
	actions: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
	actionBtn: {
		paddingTop: 6,
		paddingBottom: 6,
		paddingLeft: 12,
		paddingRight: 12,
		borderRadius: 6,
	},
	actionBtnText: { fontSize: 13, fontWeight: "500" },
} satisfies Record<string, React.CSSProperties>;
