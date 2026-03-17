import {
	type BlockConfig,
	blockRegistry,
} from "@/components/editor/blocks/BlockRegistry";
import { BlockType } from "@/components/editor/core/BlockNode";
import { getListItemNumber } from "@/components/editor/core/Document";
import { useEditorBlock, useEditorState } from "@/stores/editorStore";
import React from "react";
import { StyleSheet, View } from "react-native";

interface BlockRowHandlers {
	onContentChange: (index: number, content: string) => void;
	onBlockTypeChange?: (
		index: number,
		newType: BlockType,
		language?: string,
	) => void;
	onBackspaceAtStart: (index: number) => void;
	onSpace: (index: number, cursorOffset: number) => boolean;
	onEnter: (index: number, cursorOffset: number) => void;
	onSelectionChange: (index: number, start: number, end: number) => void;
	onDelete: (index: number) => void;
	onCheckboxToggle: (index: number) => void;
}

interface BlockRowProps {
	index: number;
	handlers: BlockRowHandlers;
}

export const BlockRow = React.memo(function BlockRow({
	index,
	handlers,
}: BlockRowProps) {
	const block = useEditorBlock(index);
	const isFocused = useEditorState(
		(s) => (s.selection?.focus.blockIndex ?? null) === index,
	);
	const listItemNumber = useEditorState((s) => {
		const b = s.document.blocks[index];
		return b?.type === BlockType.numberedList
			? getListItemNumber(s.document, index)
			: undefined;
	});

	if (!block) {
		return null;
	}

	const config: BlockConfig = {
		block,
		index,
		isFocused,
		onContentChange: handlers.onContentChange,
		onBlockTypeChange: handlers.onBlockTypeChange,
		onBackspaceAtStart: handlers.onBackspaceAtStart,
		onSpace: handlers.onSpace,
		onEnter: handlers.onEnter,
		onSelectionChange: handlers.onSelectionChange,
		onDelete: handlers.onDelete,
		listItemNumber,
		onCheckboxToggle: handlers.onCheckboxToggle,
	};

	return (
		<View style={styles.blockWrapper} collapsable={false}>
			{blockRegistry.build(config)}
		</View>
	);
});

const styles = StyleSheet.create({
	blockWrapper: {
		width: "100%",
	},
});
