import { executeEditorCommand } from "@/components/editor/keyboard/editorCommands";
import { useEditorCommandContext } from "@/components/editor/keyboard/useEditorCommandContext";
import {
	TableSizeModal,
	type TableSizeAnchorRect,
} from "@/components/editor/table/TableSizeModal";
import { IconButton } from "@/components/shared/IconButton";
import { useToolbarActions } from "@/hooks/useToolbarActions";
import { useEditorState } from "@/stores/editorStore";
import React, { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { BlockType, getListLevel, isListItem } from "./core/BlockNode";

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
});

const noop = () => {};

interface EditorToolbarProps {
	onAttachDocument?: () => void;
	hasAttachment?: boolean;
	isAttachmentVisible?: boolean;
	onShowAttachment?: () => void;
	onHideAttachment?: () => void;
	onRemoveAttachment?: () => void;
	showRelatedNotes?: boolean;
	onToggleRelatedNotes?: () => void;
	onToggleActivePanel?: () => void;
	onShowVideoModal?: () => void;
	attachedVideo?: string | null;
	resourceUrl?: string | null;
	isArticleVisible?: boolean;
	onShowArticle?: () => void;
	onHideArticle?: () => void;
	// Action overrides
	onUndo?: () => void;
	onRedo?: () => void;
	onIndent?: () => void;
	onOutdent?: () => void;
	onInsertImage?: () => void;
	onInsertCollapsible?: () => void;
	onInsertTable?: (rows: number, cols: number) => void;
}

export function EditorToolbar({
	onAttachDocument,
	hasAttachment = false,
	isAttachmentVisible = false,
	onShowAttachment,
	onHideAttachment,
	onRemoveAttachment,
	showRelatedNotes = false,
	onToggleRelatedNotes,
	onToggleActivePanel,
	onShowVideoModal,
	attachedVideo,
	resourceUrl,
	isArticleVisible = false,
	onShowArticle,
	onHideArticle,
	onUndo,
	onRedo,
	onIndent,
	onOutdent,
	onInsertImage,
	onInsertCollapsible,
	onInsertTable,
}: EditorToolbarProps) {
	const [tableSizeModalVisible, setTableSizeModalVisible] = useState(false);
	const [tableAnchorRect, setTableAnchorRect] =
		useState<TableSizeAnchorRect | null>(null);
	const tableButtonRef = useRef<View>(null);
	const canUndo = useEditorState((s) => s.getCanUndo());
	const canRedo = useEditorState((s) => s.getCanRedo());
	const block = useEditorState((s) => s.getFocusedBlock());
	const blockType = block?.type ?? null;
	const listLevel = block ? getListLevel(block) : 0;
	const commandContext = useEditorCommandContext({
		isEditorActive: true,
		isWikiLinkModalOpen: false,
		dismissOverlays: () => false,
	});
	const toolbarActions = useToolbarActions();

	const handleUndo =
		onUndo ?? (() => executeEditorCommand("undo", commandContext));
	const handleRedo =
		onRedo ?? (() => executeEditorCommand("redo", commandContext));
	const handleIndent = onIndent ?? toolbarActions.handleIndent;
	const handleOutdent = onOutdent ?? toolbarActions.handleOutdent;
	const handleInsertImage = onInsertImage ?? toolbarActions.handleInsertImage;
	const handleInsertCollapsible =
		onInsertCollapsible ?? toolbarActions.handleInsertCollapsible;
	const handleInsertTable = onInsertTable ?? toolbarActions.handleInsertTable;
	const handleOpenTablePicker = () => {
		tableButtonRef.current?.measureInWindow((x, y, width, height) => {
			setTableAnchorRect({ x, y, width, height });
			setTableSizeModalVisible(true);
		});
	};

	const isListBlock = isListItem(blockType);

	const canOutdent = isListBlock;
	const canIndent = isListBlock && listLevel >= 0;
	const canAttachDocument = onAttachDocument != null;
	const canShowAttachment = onShowAttachment != null;
	const canHideAttachment = onHideAttachment != null;
	const canRemoveAttachment = onRemoveAttachment != null;
	const attachedPanelCount = [hasAttachment, !!attachedVideo, !!resourceUrl].filter(
		Boolean,
	).length;
	const handleToggleArticle = isArticleVisible ? onHideArticle : onShowArticle;
	const articleButtonName = isArticleVisible ? "times-circle" : "newspaper-o";
	const articleButtonLabel = isArticleVisible ? "Hide article" : "View article";

	return (
		<View style={styles.toolbar}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.toolbarContent}
			>
				<IconButton name="undo" onPress={handleUndo} disabled={!canUndo} />
				<IconButton name="repeat" onPress={handleRedo} disabled={!canRedo} />
				<IconButton
					name="indent"
					onPress={handleIndent}
					disabled={!canIndent}
				/>
				<IconButton
					name="dedent"
					onPress={handleOutdent}
					disabled={!canOutdent}
				/>
				<IconButton name="angle-down" onPress={handleInsertCollapsible} />
				<View ref={tableButtonRef}>
					<IconButton
						name="table"
						onPress={handleOpenTablePicker}
						label="Insert table"
					/>
				</View>
				<IconButton
					name="image"
					onPress={() => {
						void handleInsertImage();
					}}
				/>
				{/* Document attachment */}
				{hasAttachment ? (
					<>
						<IconButton
							name={isAttachmentVisible ? "times-circle" : "eye"}
							onPress={
								isAttachmentVisible
									? (onHideAttachment ?? (() => {}))
									: (onShowAttachment ?? (() => {}))
							}
							disabled={
								isAttachmentVisible ? !canHideAttachment : !canShowAttachment
							}
							label={
								isAttachmentVisible ? "Hide attachment" : "View attachment"
							}
						/>
						<IconButton
							name="trash"
							onPress={onRemoveAttachment ?? (() => {})}
							disabled={!canRemoveAttachment}
							label="Remove attachment"
						/>
					</>
				) : (
					<IconButton
						name="paperclip"
						onPress={onAttachDocument ?? (() => {})}
						disabled={!canAttachDocument}
						label="Attach PDF or ePub"
					/>
				)}
				{/* Video */}
				{onShowVideoModal && (
					<IconButton
						name="video-camera"
						onPress={onShowVideoModal}
						label={attachedVideo ? "Manage video" : "Attach video"}
					/>
				)}
				{resourceUrl && (
					<IconButton
						name={articleButtonName}
						onPress={handleToggleArticle ?? noop}
						disabled={handleToggleArticle == null}
						label={articleButtonLabel}
					/>
				)}
				{/* Related Notes toggle */}
				{onToggleRelatedNotes && (
					<IconButton
						name={showRelatedNotes ? "unlink" : "link"}
						onPress={onToggleRelatedNotes}
						label={
							showRelatedNotes ? "Hide related notes" : "Show related notes"
						}
					/>
				)}
				{/* Panel toggle: only when multiple attachment panels are present */}
				{attachedPanelCount > 1 && onToggleActivePanel && (
					<IconButton
						name="exchange"
						onPress={onToggleActivePanel}
						label="Switch panel"
					/>
				)}
			</ScrollView>
			{tableSizeModalVisible && (
				<TableSizeModal
					visible={tableSizeModalVisible}
					anchorRect={tableAnchorRect}
					onDismiss={() => setTableSizeModalVisible(false)}
					onInsert={(rows, cols) => {
						handleInsertTable(rows, cols);
						setTableSizeModalVisible(false);
					}}
				/>
			)}
		</View>
	);
}
