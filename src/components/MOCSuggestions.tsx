import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { NoteService } from "@/services/notes/noteService";
import {
	clusterAccept,
	clusterDismiss,
	clusterRename,
	listActiveClusters,
	listClusterMembers,
	type ClusterRow,
} from "@/services/notes/clusterService";
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

interface ClusterCard {
	cluster: ClusterRow;
	memberNoteIds: string[];
}

export default function MOCSuggestions() {
	const { colors } = useExtendedTheme();
	const contentVersion = useStorageStore((s) => s.contentVersion);
	const [cards, setCards] = useState<ClusterCard[]>([]);

	const loadClusters = useCallback(async () => {
		const clusters = await listActiveClusters();
		const loaded: ClusterCard[] = await Promise.all(
			clusters.map(async (cluster) => {
				const members = await listClusterMembers(cluster.id);
				return {
					cluster,
					memberNoteIds: members.map((m) => m.note_id).slice(0, 5),
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
			await loadClusters();
		},
		[loadClusters],
	);

	const handleAccept = useCallback(
		async (card: ClusterCard) => {
			const wikiLinks = card.memberNoteIds.map((id) => `[[${id}]]`).join("\n");
			const body = `# ${card.cluster.name}\n\n${wikiLinks}\n`;
			const slug = card.cluster.name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "");
			const created = await NoteService.saveNote(
				{
					id: slug,
					title: card.cluster.name,
					content: body,
					isPinned: false,
					noteType: "note",
				},
				true,
			);
			await clusterAccept(card.cluster.id, created.id);
			await loadClusters();
		},
		[loadClusters],
	);

	const handleRename = useCallback(
		async (card: ClusterCard) => {
			if (Platform.OS === "ios" || Platform.OS === "web") {
				Alert.prompt(
					"Rename Cluster",
					"Enter a new name",
					async (newName) => {
						if (newName?.trim()) {
							await clusterRename(card.cluster.id, newName.trim());
							await loadClusters();
						}
					},
					"plain-text",
					card.cluster.name,
				);
			} else {
				Alert.alert(
					"Rename",
					"Use the Rename feature on desktop or iOS to rename this cluster.",
				);
			}
		},
		[loadClusters],
	);

	if (cards.length === 0) return null;

	return (
		<View style={styles.container}>
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
						{card.memberNoteIds.join(" · ")}
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
	container: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
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
