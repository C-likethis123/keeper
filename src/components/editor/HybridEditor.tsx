import { useEditorScrollView } from "@/components/editor/EditorScrollContext";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorBlockIds, useEditorState } from "@/stores/editorStore";
import React, { useCallback, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { BlockRow } from "./BlockRow";
import { blockRegistry } from "./blocks/BlockRegistry";
import { BlockType, createParagraphBlock } from "./core/BlockNode";
import { WikiLinkProvider } from "./wikilinks/WikiLinkContext";
import { WikiLinkModal } from "./wikilinks/WikiLinkModal";

/// A hybrid markdown/code editor widget
///
/// Features:
/// - Block-based editing with markdown support
/// - Inline markdown formatting (bold, italic, code, links)
/// - Keyboard shortcuts
/// - Undo/redo support
export function HybridEditor() {
	const blockIds = useEditorBlockIds();
	const setSelection = useEditorState((s) => s.setSelection);
	const updateBlockType = useEditorState((s) => s.updateBlockType);
	const splitBlock = useEditorState((s) => s.splitBlock);
	const deleteBlock = useEditorState((s) => s.deleteBlock);
	const mergeWithPrevious = useEditorState((s) => s.mergeWithPrevious);
	const toggleCheckbox = useEditorState((s) => s.toggleCheckbox);
	const getFocusedBlock = useEditorState((s) => s.getFocusedBlock);
	const insertBlockAfter = useEditorState((s) => s.insertBlockAfter);
	const updateBlockContent = useEditorState((s) => s.updateBlockContent);
	const ignoreNextContentChangeRef = useRef<number | null>(null);
	const ignoreSelectionChangeUntilRef = useRef(0);
	const lastSelectionOffsetRef = useRef(0);
	const { scrollViewRef, scrollYRef, viewHeightRef } = useEditorScrollView();
	const { focusBlock } = useFocusBlock();

	const handleContentChange = useCallback(
		(index: number, content: string) => {
			if (ignoreNextContentChangeRef.current === index) {
				ignoreNextContentChangeRef.current = null;
				return;
			}
			updateBlockContent(index, content);
		},
		[updateBlockContent],
	);

	const handleBlockTypeDetection = useCallback(
		(
			index: number,
			content: string,
			options?: {
				ignoreContentChange?: boolean;
				preserveFocus?: boolean;
				onlyIfTypeChanges?: boolean;
			},
		): boolean => {
			const block = getFocusedBlock();
			const detection = blockRegistry.detectBlockType(content);

			if (!detection) {
				return false;
			}

			// If onlyIfTypeChanges is true, check if type would actually change
			if (options?.onlyIfTypeChanges && block?.type === detection.type) {
				return false;
			}

			// Update block type and content
			updateBlockType(index, detection.type, detection.language);
			updateBlockContent(index, detection.remainingContent);

			if (
				detection.type === BlockType.mathBlock ||
				detection.type === BlockType.codeBlock
			) {
				insertBlockAfter(index, createParagraphBlock());
			}

			// Set ignore flag if requested to prevent feedback loop
			if (options?.ignoreContentChange) {
				ignoreNextContentChangeRef.current = index;
			}

			// Handle focus management
			const preserveFocus = options?.preserveFocus !== false; // Default to true

			if (preserveFocus) {
				focusBlock(index);
			}

			return true;
		},
		[
			insertBlockAfter,
			updateBlockType,
			updateBlockContent,
			focusBlock,
			getFocusedBlock,
		],
	);

	const handleBlockTypeChange = useCallback(
		(index: number, newType: BlockType, language?: string) => {
			updateBlockType(index, newType, language);
			focusBlock(index);
		},
		[updateBlockType, focusBlock],
	);

	const handleDelete = useCallback(
		(index: number) => {
			deleteBlock(index);
			focusBlock(index > 0 ? index - 1 : 0);
		},
		[deleteBlock, focusBlock],
	);

	const handleSpace = useCallback(
		(index: number) => {
			const block = getFocusedBlock();
			if (!block) {
				return;
			}
			// Get current content and add space (space key was just pressed)
			const newContent = `${block.content ?? ""} `;

			if (
				!handleBlockTypeDetection(index, newContent, {
					ignoreContentChange: true,
				})
			) {
				updateBlockContent(index, newContent);
			}
		},
		[updateBlockContent, handleBlockTypeDetection, getFocusedBlock],
	);

	const handleBackspaceAtStart = useCallback(
		(index: number) => {
			const block = getFocusedBlock();
			if (!block) {
				return;
			}
			const doc = useEditorState.getState().document;
			const prevBlock = index > 0 ? doc.blocks[index - 1] : null;

			// If it's a non-paragraph block (except code block and math block), convert to paragraph
			if (
				![
					BlockType.paragraph,
					BlockType.codeBlock,
					BlockType.mathBlock,
				].includes(block.type ?? BlockType.paragraph)
			) {
				updateBlockType(index, BlockType.paragraph);
				focusBlock(index);
				return;
			}

			// If it's an empty paragraph, delete and focus previous/next
			if (block.content === "") {
				deleteBlock(index);
				focusBlock(index > 0 ? index - 1 : 0);
				return;
			}

			// Merge with previous block if at start, or focus previous when it's non-mergeable (e.g. image)
			if (index > 0) {
				const prevType = prevBlock?.type;
				if (prevType === BlockType.image) {
					focusBlock(index - 1);
					return;
				}
				mergeWithPrevious(index);
				focusBlock(index - 1);
			}
		},
		[
			focusBlock,
			deleteBlock,
			getFocusedBlock,
			mergeWithPrevious,
			updateBlockType,
		],
	);

	const handleEnter = useCallback(
		(index: number, cursorOffset: number) => {
			const block = getFocusedBlock();
			if (!block) {
				return;
			}
			if ([BlockType.codeBlock, BlockType.mathBlock].includes(block.type)) {
				return;
			}
			if (
				handleBlockTypeDetection(index, block.content, {
					onlyIfTypeChanges: true,
				})
			) {
				return; // Conversion happened, don't split
			}

			// Convert empty list blocks to paragraphs
			if (
				block.content.trim() === "" &&
				[
					BlockType.numberedList,
					BlockType.bulletList,
					BlockType.checkboxList,
				].includes(block.type)
			) {
				updateBlockType(index, BlockType.paragraph);
				focusBlock(index);
				return;
			}

			ignoreSelectionChangeUntilRef.current = Date.now() + 150;
			splitBlock(index, cursorOffset);
			focusBlock(index + 1);
		},
		[
			handleBlockTypeDetection,
			focusBlock,
			updateBlockType,
			splitBlock,
			getFocusedBlock,
		],
	);

	const handleSelectionChange = useCallback(
		(index: number, start: number, end: number) => {
			lastSelectionOffsetRef.current = end;
			if (Date.now() < ignoreSelectionChangeUntilRef.current) {
				return;
			}
			const cur = useEditorState.getState().selection;
			if (
				cur?.focus.blockIndex === index &&
				cur.anchor.offset === start &&
				cur.focus.offset === end
			) {
				return;
			}
			setSelection({
				anchor: { blockIndex: index, offset: start },
				focus: { blockIndex: index, offset: end },
			});
		},
		[setSelection],
	);

	const handlers = React.useMemo(
		() => ({
			onContentChange: handleContentChange,
			onBlockTypeChange: handleBlockTypeChange,
			onBackspaceAtStart: handleBackspaceAtStart,
			onSpace: handleSpace,
			onEnter: handleEnter,
			onSelectionChange: handleSelectionChange,
			onDelete: handleDelete,
			onCheckboxToggle: toggleCheckbox,
		}),
		[
			handleContentChange,
			handleBlockTypeChange,
			handleBackspaceAtStart,
			handleSpace,
			handleEnter,
			handleSelectionChange,
			handleDelete,
			toggleCheckbox,
		],
	);

	return (
		<WikiLinkProvider>
			<View style={styles.container}>
				<ScrollView
					style={styles.scrollView}
					contentContainerStyle={styles.scrollContent}
					ref={scrollViewRef}
					keyboardShouldPersistTaps="handled"
					scrollEventThrottle={16}
					onScroll={(e) => {
						scrollYRef.current = e.nativeEvent.contentOffset.y;
					}}
					onLayout={(e) => {
						viewHeightRef.current = e.nativeEvent.layout.height;
					}}
				>
					<Pressable
						style={styles.pressableArea}
						onPress={() => {
							const blocks = useEditorState.getState().document.blocks;
							const lastIndex = Math.max(0, blocks.length - 1);
							focusBlock(lastIndex);
						}}
					>
						{blockIds.map((id, index) => (
							<BlockRow key={id} index={index} handlers={handlers} />
						))}
					</Pressable>
				</ScrollView>
				<WikiLinkModal />
			</View>
		</WikiLinkProvider>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		position: "relative",
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		paddingBottom: 20,
	},
	pressableArea: {
		flex: 1,
	},
});
