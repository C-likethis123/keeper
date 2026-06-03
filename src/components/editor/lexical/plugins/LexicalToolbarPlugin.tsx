import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import {
	INDENT_CONTENT_COMMAND,
	OUTDENT_CONTENT_COMMAND,
	REDO_COMMAND,
	UNDO_COMMAND,
} from "lexical";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { IconButton } from "@/components/shared/IconButton";

export interface LexicalToolbarPluginProps {
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
});

const noop = () => {};

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

	const handleUndo = () => editor.dispatchCommand(UNDO_COMMAND, undefined);
	const handleRedo = () => editor.dispatchCommand(REDO_COMMAND, undefined);
	const handleIndent = () =>
		editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
	const handleOutdent = () =>
		editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
	const handleInsertTable = () =>
		editor.dispatchCommand(INSERT_TABLE_COMMAND, {
			columns: "3",
			includeHeaders: true,
			rows: "2",
		});

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
		</View>
	);
}
