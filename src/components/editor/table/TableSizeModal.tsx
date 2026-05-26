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

const MAX_ROWS = 10;
const MAX_COLS = 10;
const MAX_EXPANDED_ROWS = 20;
const MAX_EXPANDED_COLS = 20;
const DEFAULT_ROWS = 3;
const DEFAULT_COLS = 5;
const CELL_SIZE = 12;
const CELL_GAP = 3;
const EXPAND_ZONE_SIZE = 24;
const POPUP_MIN_WIDTH = 276;
const POPUP_HORIZONTAL_PADDING = 20;
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
	const [visibleRows, setVisibleRows] = useState(MAX_ROWS);
	const [visibleCols, setVisibleCols] = useState(MAX_COLS);

	if (!visible) return null;

	const rowOptions = Array.from(
		{ length: visibleRows },
		(_, index) => index + 1,
	);
	const colOptions = Array.from(
		{ length: visibleCols },
		(_, index) => index + 1,
	);
	const gridWidth = visibleCols * CELL_SIZE + (visibleCols - 1) * CELL_GAP;
	const popupWidth = Math.min(
		windowWidth - POPUP_MARGIN * 2,
		Math.max(
			POPUP_MIN_WIDTH,
			gridWidth + EXPAND_ZONE_SIZE + POPUP_HORIZONTAL_PADDING * 2,
		),
	);
	const popupLeft =
		anchorRect == null
			? undefined
			: Math.max(
					POPUP_MARGIN,
					Math.min(
						anchorRect.x + anchorRect.width / 2 - popupWidth / 2,
						windowWidth - popupWidth - POPUP_MARGIN,
					),
				);
	const popupTop =
		anchorRect == null ? undefined : anchorRect.y + anchorRect.height + 12;
	const resetPicker = () => {
		setHoveredSize({ rows: DEFAULT_ROWS, cols: DEFAULT_COLS });
		setVisibleRows(MAX_ROWS);
		setVisibleCols(MAX_COLS);
	};
	const expandCols = (rows: number) => {
		setVisibleCols((currentCols) => {
			const nextCols = Math.min(currentCols + 1, MAX_EXPANDED_COLS);
			setHoveredSize((currentSize) => ({
				rows: Math.max(currentSize.rows, rows),
				cols: Math.max(currentSize.cols, nextCols),
			}));
			return nextCols;
		});
	};
	const expandRows = () => {
		setVisibleRows((currentRows) => {
			const nextRows = Math.min(currentRows + 1, MAX_EXPANDED_ROWS);
			setHoveredSize((currentSize) => ({
				rows: Math.max(currentSize.rows, nextRows),
				cols: currentSize.cols,
			}));
			return nextRows;
		});
	};

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={() => {
				resetPicker();
				onDismiss();
			}}
		>
			<Pressable
				style={styles.backdrop}
				onPress={() => {
					resetPicker();
					onDismiss();
				}}
			>
				<Pressable
					style={[
						styles.card,
						{ width: popupWidth },
						anchorRect == null
							? styles.cardFallbackPosition
							: { left: popupLeft, top: popupTop },
					]}
					onPress={() => {}}
				>
					<Text style={styles.title}>
						{hoveredSize.cols} x {hoveredSize.rows}
					</Text>

					<View style={styles.grid}>
						{rowOptions.map((rows) => (
							<View key={`row-${rows}`} style={styles.gridRow}>
								{colOptions.map((cols) => {
									const isSelected =
										rows <= hoveredSize.rows && cols <= hoveredSize.cols;

									return (
										<Pressable
											key={`cell-${rows}-${cols}`}
											style={[styles.cell, isSelected && styles.cellSelected]}
											onHoverIn={() => setHoveredSize({ rows, cols })}
											onPress={() => {
												onInsert(rows, cols);
												resetPicker();
											}}
										/>
									);
								})}
								{visibleCols < MAX_EXPANDED_COLS && (
									<Pressable
										style={styles.expandColsZone}
										onHoverIn={() => expandCols(rows)}
										onPress={() => expandCols(rows)}
									/>
								)}
							</View>
						))}
						{visibleRows < MAX_EXPANDED_ROWS && (
							<Pressable
								style={[
									styles.expandRowsZone,
									{
										width:
											gridWidth +
											(visibleCols < MAX_EXPANDED_COLS ? EXPAND_ZONE_SIZE : 0),
									},
								]}
								onHoverIn={expandRows}
								onPress={expandRows}
							/>
						)}
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
			gap: CELL_GAP,
		},
		gridRow: {
			flexDirection: "row",
			gap: CELL_GAP,
		},
		cell: {
			width: CELL_SIZE,
			height: CELL_SIZE,
			borderWidth: 1,
			borderColor: theme.dark ? "#3a4956" : "#d9e1e8",
			backgroundColor: theme.dark ? "#0f1820" : "#ffffff",
		},
		expandColsZone: {
			width: EXPAND_ZONE_SIZE,
			height: CELL_SIZE,
		},
		expandRowsZone: {
			height: EXPAND_ZONE_SIZE,
		},
		cellSelected: {
			borderColor: "#1e9bff",
			backgroundColor: theme.dark ? "rgba(30,155,255,0.35)" : "#bde5ff",
		},
	});
}
