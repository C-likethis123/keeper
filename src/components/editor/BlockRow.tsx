import {
	type BlockConfig,
	blockRegistry,
} from "@/components/editor/blocks/BlockRegistry";
import { BlockType } from "@/components/editor/core/BlockNode";
import { getListItemNumber } from "@/components/editor/core/Document";
import { useEditorBlock, useEditorState } from "@/stores/editorStore";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

interface BlockRowHandlers {
	onContentChange: (index: number, content: string) => void;
	onBlockTypeChange?: (
		index: number,
		newType: BlockType,
		language?: string,
	) => void;
	onAttributesChange?: (
		index: number,
		newAttributes: Record<string, unknown>,
	) => void;
	onBackspaceAtStart: (index: number) => void;
	onSpace: (index: number, cursorOffset: number) => boolean;
	onEnter: (index: number, cursorOffset: number) => void;
	onSelectionChange: (index: number, start: number, end: number) => void;
	onDelete: (index: number) => void;
	onCheckboxToggle: (index: number) => void;
	onOpenWikiLink: (title: string) => void;
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
		onAttributesChange: handlers.onAttributesChange,
		onBackspaceAtStart: handlers.onBackspaceAtStart,
		onSpace: handlers.onSpace,
		onEnter: handlers.onEnter,
		onSelectionChange: handlers.onSelectionChange,
		onDelete: handlers.onDelete,
		listItemNumber,
		onCheckboxToggle: handlers.onCheckboxToggle,
		onOpenWikiLink: handlers.onOpenWikiLink,
	};

	return (
		<View
			style={[
				styles.blockWrapper,
				{
					position:
						Platform.OS === "web" && config.block.type === BlockType.video
							? // biome-ignore lint/suspicious/noExplicitAny: sticky is web-only
								("sticky" as any)
							: "relative",
					zIndex: config.block.type === BlockType.video ? 20 : 1,
					top: config.block.type === BlockType.video ? 0 : undefined,
				},
			]}
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
