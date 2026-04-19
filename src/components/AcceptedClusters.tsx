import AddNoteToClusterModal from "@/components/AddNoteToClusterModal";
import type { useExtendedTheme as ThemeHook } from "@/hooks/useExtendedTheme";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { logFeedback } from "@/services/notes/clusterFeedbackService";
import {
	type ClusterRow,
	clusterAddNote,
	clusterDelete,
	clusterRemoveNote,
	listAcceptedClusters,
	listClusterMembers,
} from "@/services/notes/clusterService";
import { notesIndexDbGetById } from "@/services/notes/notesIndexDb";
import { useStorageStore } from "@/stores/storageStore";
import { useCallback, useEffect, useState } from "react";
import {
	Alert,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

interface MemberEntry {
	noteId: string;
	title: string;
}

interface AcceptedClusterCard {
	cluster: ClusterRow;
	members: MemberEntry[];
}

export default function AcceptedClusters() {
	const styles = useStyles(createStyles);
	const { colors } = useExtendedTheme();
	const contentVersion = useStorageStore((s) => s.contentVersion);
	const bumpContentVersion = useStorageStore((s) => s.bumpContentVersion);

	const [cards, setCards] = useState<AcceptedClusterCard[]>([]);
	const [addNoteTarget, setAddNoteTarget] =
		useState<AcceptedClusterCard | null>(null);

	const loadClusters = useCallback(async () => {
		const clusters = await listAcceptedClusters();
		const loaded: AcceptedClusterCard[] = await Promise.all(
			clusters.map(async (cluster) => {
				const memberRows = await listClusterMembers(cluster.id);
				const members: MemberEntry[] = await Promise.all(
					memberRows.map(async (row) => {
						const note = await notesIndexDbGetById(row.note_id);
						return { noteId: row.note_id, title: note?.title ?? row.note_id };
					}),
				);
				return { cluster, members };
			}),
		);
		setCards(loaded);
	}, []);

	useEffect(() => {
		void contentVersion;
		void loadClusters();
	}, [loadClusters, contentVersion]);

	const handleRemoveNote = useCallback(
		async (clusterId: string, noteId: string) => {
			await clusterRemoveNote(clusterId, noteId);
			const card = cards.find((c) => c.cluster.id === clusterId);
			await logFeedback(clusterId, "remove_note", {
				noteId,
				clusterName: card?.cluster.name ?? "",
			});
			bumpContentVersion();
			await loadClusters();
		},
		[loadClusters, bumpContentVersion, cards],
	);

	const handleDeleteCluster = useCallback(
		(card: AcceptedClusterCard) => {
			console.log("handleDeleteCluster called for cluster:", card.cluster.id);
			const confirmDelete = async () => {
				console.log("Delete confirmed for cluster:", card.cluster.id);
				try {
					await clusterDelete(card.cluster.id);
					await logFeedback(card.cluster.id, "delete", {
						clusterName: card.cluster.name,
						memberCount: card.members.length,
					});
					console.log("Cluster deleted successfully");
					bumpContentVersion();
					await loadClusters();
				} catch (error) {
					console.error("Failed to delete cluster:", error);
				}
			};

			if (Platform.OS === "web") {
				if (
					window.confirm(
						`Delete "${card.cluster.name}"? This cannot be undone.`,
					)
				) {
					void confirmDelete();
				}
			} else {
				Alert.alert(
					"Delete Cluster",
					`Delete "${card.cluster.name}"? This cannot be undone.`,
					[
						{ text: "Cancel", style: "cancel" },
						{
							text: "Delete",
							style: "destructive",
							onPress: confirmDelete,
						},
					],
				);
			}
		},
		[loadClusters, bumpContentVersion],
	);

	const handleAddNoteConfirm = useCallback(
		async (noteId: string) => {
			if (!addNoteTarget) return;
			await clusterAddNote(addNoteTarget.cluster.id, noteId);
			await logFeedback(addNoteTarget.cluster.id, "add_note", {
				noteId,
				clusterName: addNoteTarget.cluster.name,
			});
			setAddNoteTarget(null);
			bumpContentVersion();
			await loadClusters();
		},
		[addNoteTarget, loadClusters, bumpContentVersion],
	);

	if (cards.length === 0) return null;

	return (
		<View style={styles.container}>
			<AddNoteToClusterModal
				visible={addNoteTarget !== null}
				onClose={() => setAddNoteTarget(null)}
				onConfirm={handleAddNoteConfirm}
				excludeNoteIds={addNoteTarget?.members.map((m) => m.noteId) ?? []}
			/>
			<Text style={styles.sectionHeader}>Your MOCs</Text>
			{cards.map((card) => (
				<View
					key={card.cluster.id}
					style={[
						styles.card,
						{ backgroundColor: colors.card, borderColor: colors.border },
					]}
				>
					<Text style={styles.clusterName} numberOfLines={1}>
						{card.cluster.name}
					</Text>

					{card.members.map((member) => (
						<View key={member.noteId} style={styles.memberRow}>
							<Text style={styles.memberTitle} numberOfLines={1}>
								{member.title}
							</Text>
							<Pressable
								onPress={() => handleRemoveNote(card.cluster.id, member.noteId)}
								hitSlop={8}
								accessibilityLabel={`Remove ${member.title} from cluster`}
							>
								<Text style={styles.removeBtn}>✕</Text>
							</Pressable>
						</View>
					))}

					<View style={styles.actions}>
						<Pressable
							onPress={() => setAddNoteTarget(card)}
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
								+ Add Note
							</Text>
						</Pressable>
						<Pressable
							onPress={() => handleDeleteCluster(card)}
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
								Delete
							</Text>
						</Pressable>
					</View>
				</View>
			))}
		</View>
	);
}

function createStyles(theme: ReturnType<typeof ThemeHook>) {
	return StyleSheet.create({
		container: { paddingHorizontal: 4, paddingTop: 12, gap: 12 },
		sectionHeader: {
			fontSize: 13,
			fontWeight: "600",
			textTransform: "uppercase",
			letterSpacing: 0.5,
			marginBottom: 4,
			color: theme.colors.text,
		},
		card: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 8 },
		clusterName: {
			fontSize: 16,
			fontWeight: "600",
			color: theme.colors.text,
		},
		memberRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8,
		},
		memberTitle: {
			flex: 1,
			fontSize: 13,
			color: theme.colors.textSecondary,
		},
		removeBtn: {
			fontSize: 13,
			color: theme.colors.textSecondary,
			paddingHorizontal: 4,
		},
		actions: { flexDirection: "row", gap: 8, marginTop: 4 },
		actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
		actionBtnText: { fontSize: 13, fontWeight: "500" },
	});
}
