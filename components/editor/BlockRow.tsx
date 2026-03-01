import { getListItemNumber } from "@/components/editor/core/Document";
import { BlockType } from "@/components/editor/core/BlockNode";
import { type BlockConfig, blockRegistry } from "@/components/editor/blocks/BlockRegistry";
import { useEditorBlock, useEditorState } from "@/stores/editorStore";
import React from "react";
import { StyleSheet, View } from "react-native";

export interface BlockRowHandlers {
	onContentChange: (index: number, content: string) => void;
	onBlockTypeChange?: (
		index: number,
		newType: BlockType,
		language?: string,
	) => void;
	onBackspaceAtStart: (index: number) => void;
	onSpace: (index: number) => void;
	onEnter: (index: number, cursorOffset: number) => void;
	onSelectionChange: (index: number, start: number, end: number) => void;
	onDelete: (index: number) => void;
	onCheckboxToggle: (index: number) => void;
	onWikiLinkTriggerStart: () => void;
	onWikiLinkQueryUpdate: (query: string) => void;
	onWikiLinkTriggerEnd: () => void;
}

export interface BlockRowProps {
	index: number;
	handlers: BlockRowHandlers;
	setReference?: (ref: View | null) => void;
}

export const BlockRow = React.memo(function BlockRow({
	index,
	handlers,
	setReference,
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
		onWikiLinkTriggerStart: handlers.onWikiLinkTriggerStart,
		onWikiLinkQueryUpdate: handlers.onWikiLinkQueryUpdate,
		onWikiLinkTriggerEnd: handlers.onWikiLinkTriggerEnd,
	};

	return (
		<View
			style={styles.blockWrapper}
			ref={isFocused ? setReference : undefined}
			collapsable={false}
		>
			{blockRegistry.build(config)}
		</View>
	);
});

const styles = StyleSheet.create({
	blockWrapper: {
		width: "100%",
	},
});
