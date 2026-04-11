import { useState } from "react";
import type { GitConflictFile } from "@/services/git/engines/GitEngine";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import {
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

type ContentVersion = "base" | "ours" | "theirs";

interface ConflictDiffViewerProps {
	conflict: GitConflictFile;
	onResolve: (strategy: ContentVersion | "manual", manualContent?: string) => void;
}

const VERSION_LABELS: Record<ContentVersion, string> = {
	base: "Common Ancestor",
	ours: "Local (This Device)",
	theirs: "Remote (Server)",
};

const VERSION_COLORS: Record<ContentVersion, string> = {
	base: "#888888",
	ours: "#3b82f6",
	theirs: "#10b981",
};

export default function ConflictDiffViewer({
	conflict,
	onResolve,
}: ConflictDiffViewerProps) {
	const styles = useStyles(createStyles);
	const [activeVersion, setActiveVersion] = useState<ContentVersion>("theirs");

	const content =
		activeVersion === "base"
			? conflict.baseContent
			: activeVersion === "ours"
				? conflict.oursContent
				: conflict.theirsContent;

	const hasContent =
		conflict.baseContent || conflict.oursContent || conflict.theirsContent;

	if (!hasContent) {
		return (
			<View style={styles.emptyContainer}>
				<Text style={styles.emptyText}>No content available for this conflict</Text>
			</View>
		);
	}

	const versionButtons: { key: ContentVersion; label: string }[] = [
		{ key: "base", label: VERSION_LABELS.base },
		{ key: "ours", label: VERSION_LABELS.ours },
		{ key: "theirs", label: VERSION_LABELS.theirs },
	];

	return (
		<View style={styles.container}>
			{/* Version Selector Tabs */}
			<View style={styles.tabBar}>
				{versionButtons.map(({ key, label }) => {
					const isActive = activeVersion === key;
					const hasThisVersion =
						key === "base"
							? conflict.baseContent
							: key === "ours"
								? conflict.oursContent
								: conflict.theirsContent;

					if (!hasThisVersion) return null;

					return (
						<TouchableOpacity
							key={key}
							style={[
								styles.tab,
								isActive && styles.activeTab,
							]}
							onPress={() => setActiveVersion(key)}
							activeOpacity={0.7}
						>
							<Text
								style={[
									styles.tabText,
									isActive && { color: VERSION_COLORS[key], fontWeight: "600" },
								]}
							>
								{label}
							</Text>
						</TouchableOpacity>
					);
				})}
			</View>

			{/* Content Display */}
			<ScrollView
				style={styles.contentScroll}
				contentContainerStyle={styles.content}
			>
				<Text style={styles.contentText}>{content ?? "(empty)"}</Text>
			</ScrollView>

			{/* Resolution Actions */}
			<View style={styles.actionsContainer}>
				<Text style={styles.actionsTitle}>Resolve by keeping:</Text>
				<View style={styles.actionButtons}>
					{conflict.oursContent && (
						<TouchableOpacity
							style={[styles.actionButton, { backgroundColor: VERSION_COLORS.ours }]}
							onPress={() => onResolve("ours")}
							activeOpacity={0.8}
						>
							<Text style={styles.actionButtonText}>Local Version</Text>
						</TouchableOpacity>
					)}
					{conflict.theirsContent && (
						<TouchableOpacity
							style={[
								styles.actionButton,
								{ backgroundColor: VERSION_COLORS.theirs },
							]}
							onPress={() => onResolve("theirs")}
							activeOpacity={0.8}
						>
							<Text style={styles.actionButtonText}>Remote Version</Text>
						</TouchableOpacity>
					)}
				</View>
			</View>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			flex: 1,
		},
		tabBar: {
			flexDirection: "row",
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.border,
			paddingHorizontal: 8,
			paddingTop: 8,
		},
		tab: {
			flex: 1,
			paddingVertical: 10,
			paddingHorizontal: 12,
			borderBottomWidth: 2,
			borderBottomColor: "transparent",
			alignItems: "center",
		},
		activeTab: {
			borderBottomWidth: 2,
		},
		tabText: {
			fontSize: 12,
			color: theme.colors.textMuted,
			textAlign: "center",
		},
		contentScroll: {
			flex: 1,
		},
		content: {
			padding: 16,
		},
		contentText: {
			fontSize: 14,
			lineHeight: 20,
			fontFamily: "monospace",
			color: theme.colors.text,
		},
		actionsContainer: {
			padding: 16,
			borderTopWidth: 1,
			borderTopColor: theme.colors.border,
		},
		actionsTitle: {
			fontSize: 14,
			fontWeight: "600",
			marginBottom: 12,
			color: theme.colors.text,
		},
		actionButtons: {
			flexDirection: "row",
			gap: 8,
		},
		actionButton: {
			flex: 1,
			paddingVertical: 12,
			paddingHorizontal: 16,
			borderRadius: 8,
			alignItems: "center",
		},
		actionButtonText: {
			color: "#fff",
			fontWeight: "600",
			fontSize: 14,
		},
		emptyContainer: {
			flex: 1,
			justifyContent: "center",
			alignItems: "center",
			padding: 32,
		},
		emptyText: {
			fontSize: 14,
			color: theme.colors.textMuted,
			textAlign: "center",
		},
	});
}
