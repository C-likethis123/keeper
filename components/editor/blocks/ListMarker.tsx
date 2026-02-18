import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BlockType } from "../core/BlockNode";

interface ListMarkerProps {
	type: BlockType.bulletList | BlockType.numberedList;
	listLevel: number;
	listItemNumber?: number;
}

export function ListMarker({
	type,
	listLevel,
	listItemNumber,
}: ListMarkerProps) {
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const indent = listLevel * 16;

	if (type === BlockType.numberedList) {
		return (
			<View style={[styles.container, { paddingLeft: indent }]}>
				<Text style={styles.number}>{listItemNumber ?? 1}.</Text>
			</View>
		);
	}

	return (
		<View style={[styles.container, { paddingLeft: indent }]}>
			<View style={styles.bullet} />
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	const fontSize = theme.typography.body.fontSize ?? 16;
	const lineHeight = theme.typography.body.lineHeight ?? 24;
	const bulletSize = fontSize * 0.375;

	return StyleSheet.create({
		container: {
			justifyContent: "center",
			alignItems: "center",
			height: lineHeight,
			paddingRight: 8,
		},
		number: {
			color: theme.colors.primary,
			fontSize,
			lineHeight,
		},
		bullet: {
			width: bulletSize,
			height: bulletSize,
			borderRadius: bulletSize / 2,
			backgroundColor: theme.colors.primary,
		},
	});
}
