import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import {
	clusterAccept,
	clusterDismiss,
	clusterRename,
	listActiveClusters,
	listClusterMembers,
	type ClusterRow,
} from "@/services/notes/clusterService";
import { notesIndexDbGetById } from "@/services/notes/notesIndexDb";
import { useStorageStore } from "@/stores/storageStore";
import RenameClusterModal from "@/components/RenameClusterModal";
import { useCallback, useEffect, useState } from "react";
import {
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

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
	const [renameCard, setRenameCard] = useState<ClusterCard | null>(null);

	const loadClusters = useCallback(async () => {
		const clusters = await listActiveClusters();
		const loaded: ClusterCard[] = await Promise.all(
			clusters.map(async (cluster) => {
				const members = await listClusterMembers(cluster.id);
				const memberIds = members.map((m) => m.note_id).slice(0, 5);
				
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
		async (clusterId: string) => {
			await clusterDismiss(clusterId);
			bumpContentVersion();
			await loadClusters();
		},
		[loadClusters, bumpContentVersion],
	);

	const handleAccept = useCallback(
		async (card: ClusterCard) => {
			await clusterAccept(card.cluster.id);
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
			setRenameCard(null);
			await loadClusters();
		},
		[renameCard, loadClusters],
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
						{card.memberNoteIds.map(id => card.memberNoteTitles.get(id) || id).join(" · ")}
					</Text>
					<Text style={[styles.confidence, { color: colors.textSecondary }]}>
						{Math.round(card.cluster.confidence * 100)}% confidence
					</Text>
					<View style={styles.actions}>
						<Pressable
							onPress={() => handleAccept(card)}
							style={[styles.actionBtn, { backgroundColor: colors.primary }]}
						>
							<Text style={[styles.actionBtnText, { color: colors.primaryContrast }]}>
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
							onPress={() => handleDismiss(card.cluster.id)}
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
								style={[
									styles.actionBtnText,
									{ color: colors.textSecondary },
								]}
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
	actions: { flexDirection: "row", gap: 8, marginTop: 6 },
	actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
	actionBtnText: { fontSize: 13, fontWeight: "500" },
});
