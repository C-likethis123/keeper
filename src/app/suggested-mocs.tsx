import MOCSuggestions from "@/components/MOCSuggestions";
import { IconButton } from "@/components/shared/IconButton";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import type { ParamListBase } from "@react-navigation/native";
import { router, useNavigation } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SuggestedMOCsScreen() {
	const navigation = useNavigation<DrawerNavigationProp<ParamListBase>>();
	const insets = useSafeAreaInsets();
	const styles = useStyles(createStyles);
	const canGoBack = navigation.canGoBack();

	return (
		<View style={styles.screen}>
			<View style={[styles.header, { paddingTop: insets.top + 12 }]}>
				<View style={styles.headerRow}>
					<IconButton
						name={canGoBack ? "arrow-left" : "bars"}
						label={canGoBack ? "Back" : "Open filters"}
						variant="flat"
						onPress={() => {
							if (canGoBack) {
								router.back();
								return;
							}
							navigation.openDrawer();
						}}
					/>
					<Text style={styles.title}>Suggested MOCs</Text>
					<View style={styles.headerSpacer} />
				</View>
				<Text style={styles.subtitle}>
					Review generated clusters before accepting them into your note map.
				</Text>
			</View>
			<MOCSuggestions variant="screen" />
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		screen: {
			flex: 1,
			backgroundColor: theme.colors.background,
		},
		header: {
			paddingHorizontal: 16,
			paddingBottom: 12,
			backgroundColor: theme.colors.background,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		headerRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
		},
		headerSpacer: {
			width: 20,
		},
		title: {
			flex: 1,
			fontSize: 20,
			fontWeight: "700",
			color: theme.colors.text,
		},
		subtitle: {
			marginTop: 8,
			marginLeft: 34,
			fontSize: 14,
			lineHeight: 20,
			color: theme.colors.textMuted,
		},
	});
}
