import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import React, { useState } from "react";
import {
	Modal,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";

const MAX_ROWS = 4;
const MAX_COLS = 10;
const DEFAULT_ROWS = 3;
const DEFAULT_COLS = 5;
const ROW_OPTIONS = Array.from({ length: MAX_ROWS }, (_, index) => index + 1);
const COL_OPTIONS = Array.from({ length: MAX_COLS }, (_, index) => index + 1);
const POPUP_WIDTH = 276;
const POPUP_MARGIN = 12;

export interface TableSizeAnchorRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface TableSizeModalProps {
	visible: boolean;
	anchorRect?: TableSizeAnchorRect | null;
	onDismiss: () => void;
	onInsert: (rows: number, cols: number) => void;
}

export function TableSizeModal({
	visible,
	anchorRect,
	onDismiss,
	onInsert,
}: TableSizeModalProps) {
	const styles = useStyles(createStyles);
	const { width: windowWidth } = useWindowDimensions();
	const [hoveredSize, setHoveredSize] = useState({
		rows: DEFAULT_ROWS,
		cols: DEFAULT_COLS,
	});

	if (!visible) return null;

	const popupLeft =
		anchorRect == null
			? undefined
			: Math.max(
					POPUP_MARGIN,
					Math.min(
						anchorRect.x + anchorRect.width / 2 - POPUP_WIDTH / 2,
						windowWidth - POPUP_WIDTH - POPUP_MARGIN,
					),
				);
	const popupTop =
		anchorRect == null ? undefined : anchorRect.y + anchorRect.height + 12;

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={onDismiss}
		>
			<Pressable style={styles.backdrop} onPress={onDismiss}>
				<Pressable
					style={[
						styles.card,
						anchorRect == null
							? styles.cardFallbackPosition
							: { left: popupLeft, top: popupTop },
					]}
					onPress={() => {}}
				>
					<Text style={styles.title}>
						{hoveredSize.rows} x {hoveredSize.cols}
					</Text>

					<View style={styles.grid}>
						{ROW_OPTIONS.map((rows) => (
							<View key={`row-${rows}`} style={styles.gridRow}>
								{COL_OPTIONS.map((cols) => {
									const isSelected =
										rows <= hoveredSize.rows && cols <= hoveredSize.cols;

									return (
										<Pressable
											key={`cell-${rows}-${cols}`}
											style={[styles.cell, isSelected && styles.cellSelected]}
											onHoverIn={() => setHoveredSize({ rows, cols })}
											onPress={() => {
												onInsert(rows, cols);
												setHoveredSize({
													rows: DEFAULT_ROWS,
													cols: DEFAULT_COLS,
												});
											}}
										/>
									);
								})}
							</View>
						))}
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		backdrop: {
			flex: 1,
			backgroundColor: "transparent",
		},
		card: {
			position: "absolute",
			width: POPUP_WIDTH,
			backgroundColor: theme.colors.background,
			borderRadius: 4,
			borderWidth: 1,
			borderColor: theme.colors.border,
			paddingHorizontal: 20,
			paddingTop: 14,
			paddingBottom: 24,
			shadowColor: "#000",
			shadowOffset: { width: 0, height: 4 },
			shadowOpacity: 0.22,
			shadowRadius: 12,
			elevation: 8,
		},
		cardFallbackPosition: {
			alignSelf: "center",
			top: 96,
		},
		title: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.text,
			textAlign: "center",
			marginBottom: 12,
		},
		grid: {
			gap: 3,
		},
		gridRow: {
			flexDirection: "row",
			gap: 3,
		},
		cell: {
			width: 12,
			height: 12,
			borderWidth: 1,
			borderColor: theme.dark ? "#3a4956" : "#d9e1e8",
			backgroundColor: theme.dark ? "#0f1820" : "#ffffff",
		},
		cellSelected: {
			borderColor: "#1e9bff",
			backgroundColor: theme.dark ? "rgba(30,155,255,0.35)" : "#bde5ff",
		},
	});
}
