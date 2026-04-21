import MergeClusterModal from "@/components/MergeClusterModal";
import RenameClusterModal from "@/components/RenameClusterModal";
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
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ClusterCard {
	cluster: ClusterRow;
	memberNoteIds: string[];
	memberNoteTitles: Map<string, string>;
}

export default function MOCSuggestions() {
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
			}).catch((e) => console.warn("[MOCSuggestions] logFeedback dismiss failed:", e));
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
			}).catch((e) => console.warn("[MOCSuggestions] logFeedback accept failed:", e));
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
			}).catch((e) => console.warn("[MOCSuggestions] logFeedback rename failed:", e));
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
			}).catch((e) => console.warn("[MOCSuggestions] logFeedback merge failed:", e));
			setMergeCard(null);
			bumpContentVersion();
			await loadClusters();
		},
		[mergeCard, loadClusters, bumpContentVersion],
	);

	if (cards.length === 0) return null;

	return (
		<View style={styles.container}>
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
			<Text style={[styles.sectionHeader, { color: colors.text }]}>
				Suggested MOCs
			</Text>
			{cards.map((card) => (
				<View
					key={card.cluster.id}
					style={[
						styles.card,
						{ backgroundColor: colors.card, borderColor: colors.border },
					]}
				>
					<Text
						style={[styles.clusterName, { color: colors.text }]}
						numberOfLines={1}
					>
						{card.cluster.name}
					</Text>
					<Text
						style={[styles.members, { color: colors.textSecondary }]}
						numberOfLines={2}
					>
						{card.memberNoteIds
							.slice(0, 5)
							.map((id) => card.memberNoteTitles.get(id) || id)
							.join(" · ")}
					</Text>
					<Text style={[styles.confidence, { color: colors.textSecondary }]}>
						{Math.round(card.cluster.confidence * 100)}% confidence
					</Text>
					<View style={styles.actions}>
						<Pressable
							onPress={() => handleAccept(card)}
							style={[styles.actionBtn, { backgroundColor: colors.primary }]}
						>
							<Text
								style={[
									styles.actionBtnText,
									{ color: colors.primaryContrast },
								]}
							>
								Accept
							</Text>
						</Pressable>
						<Pressable
							onPress={() => handleRename(card)}
							style={[
								styles.actionBtn,
								{
									backgroundColor: colors.card,
									borderWidth: 1,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={[styles.actionBtnText, { color: colors.text }]}>
								Rename
							</Text>
						</Pressable>
						<Pressable
							onPress={() => handleMerge(card)}
							style={[
								styles.actionBtn,
								{
									backgroundColor: colors.card,
									borderWidth: 1,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={[styles.actionBtnText, { color: colors.text }]}>
								Merge
							</Text>
						</Pressable>
						<Pressable
							onPress={() => handleDismiss(card)}
							style={[
								styles.actionBtn,
								{
									backgroundColor: colors.card,
									borderWidth: 1,
									borderColor: colors.border,
								},
							]}
						>
							<Text
								style={[styles.actionBtnText, { color: colors.textSecondary }]}
							>
								Dismiss
							</Text>
						</Pressable>
					</View>
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { paddingHorizontal: 4, paddingTop: 12, gap: 12 },
	sectionHeader: {
		fontSize: 13,
		fontWeight: "600",
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 4,
	},
	card: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 6 },
	clusterName: { fontSize: 16, fontWeight: "600" },
	members: { fontSize: 13 },
	confidence: { fontSize: 12 },
	actions: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
	actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
	actionBtnText: { fontSize: 13, fontWeight: "500" },
});
