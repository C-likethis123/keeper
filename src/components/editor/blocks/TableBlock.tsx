import type { ExtendedTheme } from "@/constants/themes/types";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { getTableData, getTableHeaderRow } from "../core/BlockNode";
import type { BlockConfig } from "./BlockRegistry";

const CELL_WIDTH = 130;
const CELL_HEIGHT = 38;
const ROW_CTRL_WIDTH = 28;

export function TableBlock({
	block,
	index,
	onAttributesChange,
	onDelete,
}: BlockConfig) {
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);

	const [tableData, setTableData] = useState<string[][]>(() =>
		getTableData(block),
	);
	const [headerRow, setHeaderRow] = useState(() =>
		getTableHeaderRow(block),
	);

	// Sync from undo/redo
	useEffect(() => {
		setTableData(getTableData(block));
		setHeaderRow(getTableHeaderRow(block));
	}, [block.attributes]);

	const pushUpdate = useCallback(
		(newData: string[][], newHeaderRow: boolean) => {
			setTableData(newData);
			setHeaderRow(newHeaderRow);
			onAttributesChange?.(index, {
				...block.attributes,
				tableData: newData,
				headerRow: newHeaderRow,
			});
		},
		[index, block.attributes, onAttributesChange],
	);

	const handleCellChange = useCallback(
		(row: number, col: number, text: string) => {
			const newData = tableData.map((r, ri) =>
				ri === row ? r.map((c, ci) => (ci === col ? text : c)) : [...r],
			);
			pushUpdate(newData, headerRow);
		},
		[tableData, headerRow, pushUpdate],
	);

	const handleDeleteRow = useCallback(
		(rowIndex: number) => {
			if (tableData.length <= 1) {
				onDelete(index);
				return;
			}
			pushUpdate(
				tableData.filter((_, ri) => ri !== rowIndex),
				headerRow,
			);
		},
		[tableData, headerRow, pushUpdate, onDelete, index],
	);

	const handleDeleteCol = useCallback(
		(colIndex: number) => {
			const cols = tableData[0]?.length ?? 0;
			if (cols <= 1) {
				onDelete(index);
				return;
			}
			pushUpdate(
				tableData.map((row) => row.filter((_, ci) => ci !== colIndex)),
				headerRow,
			);
		},
		[tableData, headerRow, pushUpdate, onDelete, index],
	);

	const handleAddRow = useCallback(() => {
		const cols = tableData[0]?.length ?? 1;
		pushUpdate([...tableData, Array(cols).fill("")], headerRow);
	}, [tableData, headerRow, pushUpdate]);

	const handleAddCol = useCallback(() => {
		pushUpdate(
			tableData.map((row) => [...row, ""]),
			headerRow,
		);
	}, [tableData, headerRow, pushUpdate]);

	const numCols = tableData[0]?.length ?? 0;

	return (
		<View style={styles.wrapper}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				bounces={false}
			>
				<View>
					{/* Column control row: delete col buttons */}
					<View style={styles.colControlRow}>
						{/* Spacer aligned with row-delete column */}
						<View style={{ width: ROW_CTRL_WIDTH }} />
						{Array.from({ length: numCols }, (_, ci) => (
							<View
								key={ci}
								style={[styles.colControlCell, { width: CELL_WIDTH }]}
							>
								<Pressable
									style={styles.deleteBtn}
									onPress={() => handleDeleteCol(ci)}
									hitSlop={6}
								>
									<FontAwesome
										name="times-circle"
										size={13}
										color={theme.colors.textMuted}
									/>
								</Pressable>
							</View>
						))}
						{/* Spacer aligned with add-column button */}
						<View style={{ width: 32 }} />
					</View>

					{/* Data rows */}
					{tableData.map((row, ri) => {
						const isHeader = headerRow && ri === 0;
						return (
							<View key={ri} style={styles.row}>
								{/* Row delete button */}
								<Pressable
									style={[styles.rowCtrl, { width: ROW_CTRL_WIDTH }]}
									onPress={() => handleDeleteRow(ri)}
									hitSlop={6}
								>
									<FontAwesome
										name="times-circle"
										size={13}
										color={theme.colors.textMuted}
									/>
								</Pressable>

								{row.map((cell, ci) => (
									<View
										key={ci}
										style={[
											styles.cell,
											{ width: CELL_WIDTH, height: CELL_HEIGHT },
											isHeader && styles.headerCell,
											ci === row.length - 1 && styles.cellLastInRow,
										]}
									>
										<TextInput
											style={[
												styles.cellInput,
												isHeader && styles.headerCellText,
											]}
											value={cell}
											onChangeText={(text) =>
												handleCellChange(ri, ci, text)
											}
											multiline={false}
											returnKeyType="next"
											autoCapitalize="none"
											autoCorrect={false}
										/>
									</View>
								))}
						</View>
						);
					})}

					{/* Bottom control row: add row */}
					<View style={styles.bottomRow}>
						<View style={{ width: ROW_CTRL_WIDTH }} />
						<Pressable
							style={[
								styles.addRowBtn,
								{ width: numCols * CELL_WIDTH },
							]}
							onPress={handleAddRow}
						>
							<FontAwesome
								name="plus"
								size={11}
								color={theme.colors.textMuted}
							/>
							<Text style={styles.addBtnText}>Add row</Text>
						</Pressable>
					</View>
				</View>

				{/* Add column button: vertically centered beside the table */}
				<Pressable style={styles.addColBtn} onPress={handleAddCol}>
					<FontAwesome name="plus" size={11} color={theme.colors.textMuted} />
					<Text style={[styles.addBtnText, styles.addColText]}>Col</Text>
				</Pressable>
			</ScrollView>
		</View>
	);
}

function createStyles(theme: ExtendedTheme) {
	const borderColor = theme.colors.border;
	const headerBg =
		theme.dark
			? "rgba(255,255,255,0.08)"
			: "rgba(0,0,0,0.06)";

	return StyleSheet.create({
		wrapper: {
			marginHorizontal: 14,
			marginVertical: 4,
		},
		colControlRow: {
			flexDirection: "row",
			alignItems: "center",
			height: 20,
		},
		colControlCell: {
			alignItems: "center",
			justifyContent: "center",
		},
		deleteBtn: {
			padding: 2,
		},
		row: {
			flexDirection: "row",
			alignItems: "stretch",
		},
		rowCtrl: {
			alignItems: "center",
			justifyContent: "center",
		},
		cell: {
			borderWidth: 1,
			borderColor,
			borderRightWidth: 0,
			borderBottomWidth: 0,
			paddingHorizontal: 6,
			justifyContent: "center",
		},
		cellLastInRow: {
			borderRightWidth: 1,
		},
		headerCell: {
			backgroundColor: headerBg,
		},
		cellInput: {
			fontSize: 14,
			color: theme.colors.text,
			padding: 0,
		},
		headerCellText: {
			fontWeight: "600",
		},
		bottomRow: {
			flexDirection: "row",
			borderTopWidth: 1,
			borderColor,
		},
		addRowBtn: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 4,
			paddingVertical: 6,
			borderWidth: 1,
			borderTopWidth: 0,
			borderColor,
		},
		addColBtn: {
			alignItems: "center",
			justifyContent: "center",
			gap: 4,
			width: 32,
			marginLeft: 4,
			borderWidth: 1,
			borderColor,
			borderRadius: 6,
		},
		addColText: {
			fontSize: 10,
		},
		addBtnText: {
			fontSize: 12,
			color: theme.colors.textMuted,
		},
	});
}
