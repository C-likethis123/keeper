import ConflictComparisonView from "@/components/shared/ConflictComparisonView";
import type { GitConflictFile } from "@/services/git/engines/GitEngine";
import { ConflictDetectionService } from "@/services/git/conflictDetectionService";
import { getGitEngine } from "@/services/git/gitEngine";
import { useConflictStore } from "@/stores/conflictStore";
import { useToastStore } from "@/stores/toastStore";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";

interface ConflictResolutionModalProps {
	visible: boolean;
	conflicts: GitConflictFile[];
	onComplete: () => void;
}

export default function ConflictResolutionModal({
	visible,
	conflicts,
	onComplete,
}: ConflictResolutionModalProps) {
	const router = useRouter();
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isResolving, setIsResolving] = useState(false);
	const conflictStore = useConflictStore();

	const currentConflict = conflicts[currentIndex];
	const progressText = `${currentIndex + 1} of ${conflicts.length}`;

	const handleResolve = async (
		strategy: "ours" | "theirs" | "base" | "manual",
		manualContent?: string,
	) => {
		if (!currentConflict) return;

		try {
			const engine = getGitEngine();
			const detectionService = new ConflictDetectionService(engine);

			await detectionService.resolveConflict(
				currentConflict.path,
				strategy,
				manualContent,
			);

			conflictStore.markResolved(currentConflict.path, strategy);

			if (currentIndex < conflicts.length - 1) {
				setCurrentIndex((prev) => prev + 1);
			} else {
				// All conflicts resolved
				useToastStore.getState().showToast(
					`All ${conflicts.length} conflicts resolved successfully`,
					3000,
				);
				onComplete();
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			Alert.alert("Resolution Failed", `Could not resolve conflict: ${message}`);
		}
	};

	const handleResolveAll = async (strategy: "ours" | "theirs" | "base") => {
		Alert.alert(
			"Resolve All Conflicts",
			`This will keep the ${strategy === "ours" ? "local" : strategy === "theirs" ? "remote" : "common ancestor"} version for all ${conflicts.length} conflicts. Continue?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Resolve All",
					style: "destructive",
					onPress: async () => {
						setIsResolving(true);
						try {
							const engine = getGitEngine();
							const detectionService = new ConflictDetectionService(engine);

							const resolvedCount =
								await detectionService.resolveAllConflicts(strategy);

							conflictStore.markAllResolved(strategy);

							useToastStore.getState().showToast(
								`${resolvedCount} conflicts resolved`,
								3000,
							);
							onComplete();
						} catch (error) {
							const message =
								error instanceof Error ? error.message : String(error);
							Alert.alert("Failed", `Could not resolve conflicts: ${message}`);
						} finally {
							setIsResolving(false);
						}
					},
				},
			],
		);
	};

	if (!currentConflict || conflicts.length === 0 || !visible) {
		return null;
	}

	return (
		<View style={styles.overlay}>
			<View style={styles.container}>
				{/* Header */}
				<View style={styles.header}>
					<View style={styles.headerLeft}>
						<Text style={styles.headerTitle}>Sync Conflicts</Text>
						<Text style={styles.progressText}>{progressText}</Text>
					</View>
					<Pressable
						style={styles.closeButton}
						onPress={() => {
							router.back();
							onComplete();
						}}
					>
						<Text style={styles.closeButtonText}>Done</Text>
					</Pressable>
				</View>

				{/* Conflict Info */}
				<View style={styles.conflictInfo}>
					<Text style={styles.fileName}>
						{ConflictDetectionService.getPathDisplayName(currentConflict.path)}
					</Text>
					<Text style={styles.filePath}>{currentConflict.path}</Text>
				</View>

				{/* Comparison View */}
				<ConflictComparisonView
					key={currentConflict.path}
					conflict={currentConflict}
					onResolve={handleResolve}
				/>

				{/* Footer Actions */}
				<View style={styles.footer}>
					{currentIndex > 0 && (
						<Pressable
							style={styles.navButton}
							onPress={() => setCurrentIndex((prev) => prev - 1)}
						>
							<Text style={styles.navButtonText}>Previous</Text>
						</Pressable>
					)}
					<View style={styles.resolveAllButtons}>
						<Pressable
							style={[styles.resolveAllButton, styles.resolveAllButtonSecondary]}
							onPress={() => handleResolveAll("theirs")}
							disabled={isResolving}
						>
							<Text style={styles.resolveAllButtonSecondaryText}>
								Keep All Remote
							</Text>
						</Pressable>
						<Pressable
							style={[styles.resolveAllButton, styles.resolveAllButtonPrimary]}
							onPress={() => handleResolveAll("ours")}
							disabled={isResolving}
						>
							<Text style={styles.resolveAllButtonPrimaryText}>
								Keep All Local
							</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		position: "fixed",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: 9999,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	container: {
		width: "90%",
		maxWidth: 800,
		height: "80%",
		maxHeight: 600,
		backgroundColor: "#fff",
		borderRadius: 12,
		overflow: "hidden",
		display: "flex",
		flexDirection: "column",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
	},
	headerLeft: {
		flexDirection: "column",
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: "700",
		color: "#111",
	},
	progressText: {
		fontSize: 13,
		color: "#666",
		marginTop: 2,
	},
	closeButton: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 6,
		backgroundColor: "#f0f0f0",
	},
	closeButtonText: {
		fontSize: 15,
		fontWeight: "600",
		color: "#333",
	},
	conflictInfo: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#f9f9f9",
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
	},
	fileName: {
		fontSize: 16,
		fontWeight: "600",
		color: "#222",
	},
	filePath: {
		fontSize: 12,
		color: "#888",
		marginTop: 2,
		fontFamily: "monospace",
	},
	footer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		padding: 16,
		borderTopWidth: 1,
		borderTopColor: "#eee",
		backgroundColor: "#fafafa",
	},
	navButton: {
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 8,
		backgroundColor: "#f0f0f0",
	},
	navButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#333",
	},
	resolveAllButtons: {
		flex: 1,
		flexDirection: "row",
		gap: 8,
	},
	resolveAllButton: {
		flex: 1,
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderRadius: 8,
		alignItems: "center",
	},
	resolveAllButtonPrimary: {
		backgroundColor: "#3b82f6",
	},
	resolveAllButtonSecondary: {
		backgroundColor: "#e5e7eb",
	},
	resolveAllButtonPrimaryText: {
		color: "#fff",
		fontWeight: "600",
		fontSize: 13,
	},
	resolveAllButtonSecondaryText: {
		color: "#333",
		fontWeight: "600",
		fontSize: 13,
	},
});
