import {
	type BlockConfig,
	blockRegistry,
} from "@/components/editor/blocks/BlockRegistry";
import { BlockType } from "@/components/editor/core/BlockNode";
import { getListItemNumber } from "@/components/editor/core/Document";
import { useEditorBlock, useEditorState } from "@/stores/editorStore";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

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
	onBlockExit?: (index: number) => void;
	onSelectionChange: (index: number, start: number, end: number) => void;
	onDelete: (index: number) => void;
	onCheckboxToggle: (index: number) => void;
	onOpenWikiLink: (title: string) => void;
	selectBlock: (index: number) => void;
	selectBlockRange: (anchor: number, focus: number) => void;
	selectGap: (index: number) => void;
	clearStructuredSelection: () => void;
}

interface BlockRowProps {
	index: number;
	handlers: BlockRowHandlers;
	isLastBlock: boolean;
}

export const BlockRow = React.memo(function BlockRow({
	index,
	handlers,
	isLastBlock,
}: BlockRowProps) {
	const block = useEditorBlock(index);
	const isFocused = useEditorState(
		(s) => (s.selection?.focus.blockIndex ?? null) === index,
	);
	const blockSelection = useEditorState((s) => s.blockSelection);
	const blockSelectionAnchor = useEditorState((s) => s.blockSelectionAnchor);
	const gapSelection = useEditorState((s) => s.gapSelection);

	const isBlockSelected =
		blockSelection !== null &&
		index >= blockSelection.start &&
		index <= blockSelection.end;

	const isGapSelected = gapSelection === index;
	const isLastGapSelected = isLastBlock && gapSelection === index + 1;

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
		hasBlockSelection: isBlockSelected,
		isGapSelected,
		onContentChange: handlers.onContentChange,
		onBlockTypeChange: handlers.onBlockTypeChange,
		onAttributesChange: handlers.onAttributesChange,
		onBackspaceAtStart: handlers.onBackspaceAtStart,
		onSpace: handlers.onSpace,
		onEnter: handlers.onEnter,
		onBlockExit: handlers.onBlockExit,
		onSelectionChange: handlers.onSelectionChange,
		onDelete: handlers.onDelete,
		listItemNumber,
		onCheckboxToggle: handlers.onCheckboxToggle,
		onOpenWikiLink: handlers.onOpenWikiLink,
	};

	const handleGutterPress = (e: any) => {
		if (e.shiftKey && blockSelectionAnchor !== null) {
			handlers.selectBlockRange(blockSelectionAnchor, index);
		} else {
			handlers.selectBlock(index);
		}
	};

	return (
		<View style={styles.rowContainer}>
			{/* Gap above block i (Gap i) */}
			<Pressable
				style={[styles.gap, isGapSelected && styles.gapSelected]}
				onPress={() => handlers.selectGap(index)}
			/>

			<View style={[styles.blockRow, isBlockSelected && styles.rowSelected]}>
				<Pressable style={styles.gutter} onPress={handleGutterPress}>
					<View style={styles.gutterHandle} />
				</Pressable>

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
			</View>

			{/* Gap below the very last block (Gap blocks.length) */}
			{isLastBlock && (
				<Pressable
					style={[styles.gap, isLastGapSelected && styles.gapSelected]}
					onPress={() => handlers.selectGap(index + 1)}
				/>
			)}
		</View>
	);
});

const styles = StyleSheet.create({
	rowContainer: {
		width: "100%",
	},
	blockRow: {
		flexDirection: "row",
		width: "100%",
		paddingLeft: 4,
	},
	rowSelected: {
		backgroundColor: "rgba(0, 122, 255, 0.1)",
	},
	gutter: {
		width: 12,
		justifyContent: "center",
		alignItems: "center",
		marginRight: 4,
	},
	gutterHandle: {
		width: 4,
		height: "80%",
		backgroundColor: "rgba(0, 0, 0, 0.05)",
		borderRadius: 2,
	},
	gap: {
		height: 4,
		width: "100%",
	},
	gapSelected: {
		backgroundColor: "#007AFF",
		height: 4,
	},
	blockWrapper: {
		flex: 1,
	},
});
