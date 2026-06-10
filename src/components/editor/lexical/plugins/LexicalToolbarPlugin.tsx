import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
	$insertTableColumnAtSelection,
	$insertTableRowAtSelection,
	INSERT_TABLE_COMMAND,
} from "@lexical/table";
import {
	INDENT_CONTENT_COMMAND,
	OUTDENT_CONTENT_COMMAND,
	REDO_COMMAND,
	UNDO_COMMAND,
} from "lexical";
import React, { useState } from "react";
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { IconButton } from "@/components/shared/IconButton";

interface LexicalToolbarPluginProps {
	hasAttachment?: boolean;
	onAttachDocument?: () => void;
	onInsertImage?: () => void;
	onRemoveAttachment?: () => void;
	onShowVideoModal?: () => void;
	onToggleArticle?: () => void;
	onToggleRelatedNotes?: () => void;
	onToggleActivePanel?: () => void;
}

const styles = StyleSheet.create({
	toolbar: {
		borderBottomWidth: 1,
		paddingVertical: 8,
		paddingHorizontal: 16,
	},
	toolbarContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	modalBackdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "rgba(0, 0, 0, 0.35)",
		padding: 24,
	},
	dialog: {
		width: "100%",
		maxWidth: 320,
		borderRadius: 8,
		backgroundColor: "#fff",
		padding: 16,
		gap: 12,
	},
	dialogTitle: {
		color: "#111",
		fontSize: 16,
		fontWeight: "600",
	},
	field: {
		gap: 6,
	},
	label: {
		color: "#111",
		fontSize: 13,
		fontWeight: "500",
	},
	input: {
		borderWidth: 1,
		borderColor: "#d0d0d0",
		borderRadius: 6,
		color: "#111",
		fontSize: 16,
		paddingHorizontal: 10,
		paddingVertical: 8,
	},
	toggleText: {
		color: "#111",
	},
	headerToggle: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingVertical: 4,
	},
	checkbox: {
		width: 18,
		height: 18,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "#777",
		borderRadius: 3,
	},
	actions: {
		flexDirection: "row",
		justifyContent: "flex-end",
		gap: 8,
	},
	actionButton: {
		borderRadius: 6,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	primaryButton: {
		backgroundColor: "#222",
	},
	buttonText: {
		color: "#111",
		fontWeight: "600",
	},
	primaryButtonText: {
		color: "#fff",
	},
});

const noop = () => {};
const clampTableSize = (value: string) => {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed)) {
		return 1;
	}
	return Math.min(Math.max(parsed, 1), 20);
};

export function LexicalToolbarPlugin({
	hasAttachment = false,
	onAttachDocument,
	onInsertImage,
	onRemoveAttachment,
	onShowVideoModal,
	onToggleArticle,
	onToggleRelatedNotes,
	onToggleActivePanel,
}: LexicalToolbarPluginProps) {
	const [editor] = useLexicalComposerContext();
	const [isTableDialogVisible, setIsTableDialogVisible] = useState(false);
	const [rows, setRows] = useState("2");
	const [columns, setColumns] = useState("3");
	const [includeHeaders, setIncludeHeaders] = useState(true);

	const handleUndo = () => editor.dispatchCommand(UNDO_COMMAND, undefined);
	const handleRedo = () => editor.dispatchCommand(REDO_COMMAND, undefined);
	const handleIndent = () =>
		editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
	const handleOutdent = () =>
		editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
	const handleInsertTable = () => setIsTableDialogVisible(true);
	const handleInsertTableRow = () => {
		editor.update(
			() => {
				try {
					$insertTableRowAtSelection(true);
				} catch {
					return;
				}
			},
			{ discrete: true },
		);
	};
	const handleInsertTableColumn = () => {
		editor.update(
			() => {
				try {
					$insertTableColumnAtSelection(true);
				} catch {
					return;
				}
			},
			{ discrete: true },
		);
	};
	const handleConfirmTable = () => {
		editor.dispatchCommand(INSERT_TABLE_COMMAND, {
			columns: String(clampTableSize(columns)),
			includeHeaders,
			rows: String(clampTableSize(rows)),
		});
		setIsTableDialogVisible(false);
	};

	return (
		<View style={styles.toolbar}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.toolbarContent}
			>
				<IconButton name="undo" onPress={handleUndo} />
				<IconButton name="repeat" onPress={handleRedo} />
				<IconButton name="indent" onPress={handleIndent} />
				<IconButton name="dedent" onPress={handleOutdent} />
				<IconButton name="table" onPress={handleInsertTable} label="Insert table" />
				<IconButton
					name="plus-square-o"
					onPress={handleInsertTableRow}
					label="Add table row"
				/>
				<IconButton
					name="columns"
					onPress={handleInsertTableColumn}
					label="Add table column"
				/>
				<IconButton
					name="image"
					onPress={onInsertImage ?? noop}
					disabled={!onInsertImage}
					label="Insert image"
				/>
				<IconButton
					name="paperclip"
					onPress={onAttachDocument ?? noop}
					disabled={!onAttachDocument}
					label="Attach PDF or ePub"
				/>
				{hasAttachment ? (
					<IconButton
						name="trash-o"
						onPress={onRemoveAttachment ?? noop}
						disabled={!onRemoveAttachment}
						label="Remove attachment"
					/>
				) : null}
				<IconButton
					name="video-camera"
					onPress={onShowVideoModal ?? noop}
					disabled={!onShowVideoModal}
					label="Attach video"
				/>
				<IconButton
					name="newspaper-o"
					onPress={onToggleArticle ?? noop}
					disabled={!onToggleArticle}
					label="View article"
				/>
				<IconButton
					name="link"
					onPress={onToggleRelatedNotes ?? noop}
					disabled={!onToggleRelatedNotes}
					label="Show related notes"
				/>
				<IconButton
					name="exchange"
					onPress={onToggleActivePanel ?? noop}
					disabled={!onToggleActivePanel}
					label="Switch panel"
				/>
			</ScrollView>
			<Modal
				animationType="fade"
				transparent
				visible={isTableDialogVisible}
				onRequestClose={() => setIsTableDialogVisible(false)}
			>
				<View style={styles.modalBackdrop}>
					<View style={styles.dialog}>
						<Text style={styles.dialogTitle}>Insert table</Text>
						<View style={styles.field}>
							<Text style={styles.label}>Rows</Text>
							<TextInput
								keyboardType="number-pad"
								onChangeText={setRows}
								style={styles.input}
								value={rows}
							/>
						</View>
						<View style={styles.field}>
							<Text style={styles.label}>Columns</Text>
							<TextInput
								keyboardType="number-pad"
								onChangeText={setColumns}
								style={styles.input}
								value={columns}
							/>
						</View>
						<Pressable
							accessibilityRole="checkbox"
							accessibilityState={{ checked: includeHeaders }}
							onPress={() => setIncludeHeaders((current) => !current)}
							style={styles.headerToggle}
						>
							<View style={styles.checkbox}>
								<Text style={styles.toggleText}>{includeHeaders ? "x" : ""}</Text>
							</View>
							<Text style={styles.toggleText}>Header row</Text>
						</Pressable>
						<View style={styles.actions}>
							<Pressable
								onPress={() => setIsTableDialogVisible(false)}
								style={styles.actionButton}
							>
								<Text style={styles.buttonText}>Cancel</Text>
							</Pressable>
							<Pressable
								onPress={handleConfirmTable}
								style={[styles.actionButton, styles.primaryButton]}
							>
								<Text style={[styles.buttonText, styles.primaryButtonText]}>
									Insert
								</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
}
