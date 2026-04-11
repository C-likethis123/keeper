import { useConflictResolution } from "@/hooks/useConflictResolution";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ConflictBannerProps {
	onPress?: () => void;
}

export default function ConflictBanner({ onPress }: ConflictBannerProps) {
	const styles = useStyles(createStyles);
	const {
		hasUnresolvedConflicts,
		unresolvedCount,
		showConflictModal,
	} = useConflictResolution();

	if (!hasUnresolvedConflicts) {
		return null;
	}

	const handlePress = () => {
		if (onPress) {
			onPress();
		} else {
			showConflictModal();
		}
	};

	return (
		<Pressable style={styles.banner} onPress={handlePress}>
			<View style={styles.iconContainer}>
				<Text style={styles.icon}>⚠️</Text>
			</View>
			<View style={styles.textContainer}>
				<Text style={styles.title}>Sync Conflicts Detected</Text>
				<Text style={styles.subtitle}>
					{unresolvedCount === 1
						? "1 file has conflicting changes"
						: `${unresolvedCount} files have conflicting changes`}
				</Text>
			</View>
			<View style={styles.actionContainer}>
				<Text style={styles.actionText}>Resolve →</Text>
			</View>
		</Pressable>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		banner: {
			flexDirection: "row",
			alignItems: "center",
			backgroundColor: theme.colors.background,
			borderLeftWidth: 4,
			borderLeftColor: theme.colors.error,
			padding: 12,
			marginBottom: 8,
			borderRadius: 8,
			elevation: 2,
			shadowColor: "#000",
			shadowOffset: { width: 0, height: 1 },
			shadowOpacity: 0.1,
			shadowRadius: 2,
		},
		iconContainer: {
			marginRight: 12,
		},
		icon: {
			fontSize: 24,
		},
		textContainer: {
			flex: 1,
		},
		title: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.text,
		},
		subtitle: {
			fontSize: 12,
			color: theme.colors.textMuted,
			marginTop: 2,
		},
		actionContainer: {
			paddingHorizontal: 8,
		},
		actionText: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.primary,
		},
	});
}
