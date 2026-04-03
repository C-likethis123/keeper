import { useEditorScrollView } from "@/components/editor/EditorScrollContext";
import { useEditorCommandContext } from "@/components/editor/keyboard/useEditorCommandContext";
import { useEditorKeyboardShortcuts } from "@/components/editor/keyboard/useEditorKeyboardShortcuts";
import { resolveOrCreateWikiLinkNoteId } from "@/components/editor/wikilinks/wikiLinkUtils";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorBlockIds, useEditorState } from "@/stores/editorStore";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { BlockRow } from "./BlockRow";
import { blockRegistry } from "./blocks/BlockRegistry";
import {
	BlockType,
	createCollapsibleBlock,
	createParagraphBlock,
	getCollapsibleSummary,
} from "./core/BlockNode";
import {
	SlashCommandProvider,
	useSlashCommandContext,
} from "./slash-commands/SlashCommandContext";
import { SlashCommandModal } from "./slash-commands/SlashCommandModal";
import {
	WikiLinkProvider,
	useWikiLinkContext,
} from "./wikilinks/WikiLinkContext";
import { WikiLinkModal } from "./wikilinks/WikiLinkModal";
import { WikiLinkActions } from "./wikilinks/WikiLinkActions";

/// A hybrid markdown/code editor widget
///
/// Features:
/// - Block-based editing with markdown support
/// - Inline markdown formatting (bold, italic, code, links)
/// - Keyboard shortcuts
/// - Undo/redo support
interface HybridEditorProps {
	onInsertTemplateCommand?: () => void | Promise<void>;
}

export function HybridEditor({
	onInsertTemplateCommand,
}: HybridEditorProps = {}) {
	return (
		<WikiLinkProvider>
			<SlashCommandProvider onInsertTemplateCommand={onInsertTemplateCommand}>
				<HybridEditorContent />
			</SlashCommandProvider>
		</WikiLinkProvider>
	);
}

function HybridEditorContent() {
	const router = useRouter();
	const blockIds = useEditorBlockIds();
	const blocks = useEditorState((s) => s.document.blocks);
	const setSelection = useEditorState((s) => s.setSelection);
	const selection = useEditorState((s) => s.selection);
	const updateBlockType = useEditorState((s) => s.updateBlockType);
	const splitBlock = useEditorState((s) => s.splitBlock);
	const deleteBlock = useEditorState((s) => s.deleteBlock);
	const mergeWithPrevious = useEditorState((s) => s.mergeWithPrevious);
	const toggleCheckbox = useEditorState((s) => s.toggleCheckbox);
	const getFocusedBlock = useEditorState((s) => s.getFocusedBlock);
	const insertBlockAfter = useEditorState((s) => s.insertBlockAfter);
	const updateBlockContent = useEditorState((s) => s.updateBlockContent);
	const updateBlockAttributes = useEditorState((s) => s.updateBlockAttributes);
	const ignoreNextContentChangeRef = useRef<number | null>(null);
	const ignoreSelectionChangeUntilRef = useRef(0);
	const lastSelectionOffsetRef = useRef(0);
	const { scrollViewRef, updateScrollY, updateViewHeight } =
		useEditorScrollView();
	const { focusBlock } = useFocusBlock();
	const wikiLinks = useWikiLinkContext();
	const slashCommands = useSlashCommandContext();
	const commandContext = useEditorCommandContext({
		isEditorActive: selection !== null,
		isWikiLinkModalOpen: wikiLinks.isActive || slashCommands.isActive,
		dismissOverlays: () => {
			if (slashCommands.isActive) {
				slashCommands.handleCancel();
				return true;
			}
			if (wikiLinks.isActive) {
				wikiLinks.handleCancel();
				return true;
			}
			return false;
		},
	});
	useEditorKeyboardShortcuts({ context: commandContext });

	const getBlockAtIndex = useCallback((index: number) => {
		return useEditorState.getState().document.blocks[index] ?? null;
	}, []);

	const handleContentChange = useCallback(
		(index: number, content: string) => {
			if (ignoreNextContentChangeRef.current === index) {
				ignoreNextContentChangeRef.current = null;
				return;
			}
			const oldContent =
				useEditorState.getState().document.blocks[index]?.content ?? "";
			const delta = content.length - oldContent.length;
			const newCursor = Math.max(
				0,
				Math.min(content.length, lastSelectionOffsetRef.current + delta),
			);
			updateBlockContent(index, content, newCursor);
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
			updateBlockContent(index, detection.remainingContent, 0);

			if (
				detection.type === BlockType.mathBlock ||
				detection.type === BlockType.codeBlock ||
				detection.type === BlockType.collapsibleBlock
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
		(index: number, cursorOffset: number) => {
			const block = getFocusedBlock();
			if (!block) {
				return false;
			}

			if (cursorOffset !== block.content.length) {
				return false;
			}

			const newContent = `${block.content} `;

			if (
				!handleBlockTypeDetection(index, newContent, {
					ignoreContentChange: true,
				})
			) {
				return false;
			}

			return true;
		},
		[handleBlockTypeDetection, getFocusedBlock],
	);

	const handleBackspaceAtStart = useCallback(
		(index: number) => {
			const block = getBlockAtIndex(index);
			if (!block) {
				return;
			}
			const doc = useEditorState.getState().document;
			const prevBlock = index > 0 ? doc.blocks[index - 1] : null;

			// If it's a non-paragraph block (except code block, math block, and collapsible block), convert to paragraph
			if (
				![
					BlockType.paragraph,
					BlockType.codeBlock,
					BlockType.mathBlock,
					BlockType.collapsibleBlock,
				].includes(block.type ?? BlockType.paragraph)
			) {
				updateBlockType(index, BlockType.paragraph);
				focusBlock(index);
				return;
			}

			// If it's an empty block, delete and focus previous/next
			const isEmpty =
				block.type === BlockType.collapsibleBlock
					? block.content === "" && getCollapsibleSummary(block) === ""
					: block.content === "";

			if (isEmpty) {
				deleteBlock(index);
				focusBlock(index > 0 ? index - 1 : 0);
				return;
			}

			// Collapsible blocks with content can't be merged into the previous block
			if (block.type === BlockType.collapsibleBlock) {
				return;
			}

			// Merge with previous block if at start, or focus previous when it's non-mergeable (e.g. image, collapsible)
			if (index > 0) {
				const prevType = prevBlock?.type;
				if (
					prevType &&
					[
						BlockType.image,
						BlockType.video,
						BlockType.collapsibleBlock,
					].includes(prevType)
				) {
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
			getBlockAtIndex,
			mergeWithPrevious,
			updateBlockType,
		],
	);

	const handleEnter = useCallback(
		(index: number, cursorOffset: number, zone?: string) => {
			const block = getBlockAtIndex(index);
			if (!block) {
				return;
			}
			if ([BlockType.codeBlock, BlockType.mathBlock].includes(block.type)) {
				return;
			}
			if (block.type === BlockType.collapsibleBlock) {
				if (zone === "summary") {
					// Focus is now handled locally in CollapsibleBlock.tsx
					return;
				}

				// Split the body
				const content = block.content;
				// If we are at an empty line, cursorOffset is at a position where previous char is \n.
				// We want to remove that \n to ensure a clean split.
				const before = content.substring(0, cursorOffset).replace(/\n$/, "");
				const after = content.substring(cursorOffset).replace(/^\n/, "");

				handleContentChange(index, before);
				insertBlockAfter(index, createParagraphBlock(after));
				focusBlock(index + 1);
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
			getBlockAtIndex,
			insertBlockAfter,
			handleContentChange,
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

	const handleOpenWikiLink = useCallback(
		async (title: string) => {
			const noteId = await resolveOrCreateWikiLinkNoteId(title);
			if (!noteId) {
				return;
			}

			router.push(`/editor?id=${noteId}`);
		},
		[router],
	);

	const handleAttributesChange = useCallback(
		(index: number, newAttributes: Record<string, unknown>) => {
			updateBlockAttributes(index, newAttributes);
		},
		[updateBlockAttributes],
	);

	const handlers = React.useMemo(
		() => ({
			onContentChange: handleContentChange,
			onBlockTypeChange: handleBlockTypeChange,
			onAttributesChange: handleAttributesChange,
			onBackspaceAtStart: handleBackspaceAtStart,
			onSpace: handleSpace,
			onEnter: handleEnter,
			onSelectionChange: handleSelectionChange,
			onDelete: handleDelete,
			onCheckboxToggle: toggleCheckbox,
			onOpenWikiLink: handleOpenWikiLink,
		}),
		[
			handleContentChange,
			handleBlockTypeChange,
			handleAttributesChange,
			handleBackspaceAtStart,
			handleSpace,
			handleEnter,
			handleSelectionChange,
			handleDelete,
			toggleCheckbox,
			handleOpenWikiLink,
		],
	);

	const stickyHeaderIndices = useMemo(() => {
		if (Platform.OS === "web") {
			return undefined;
		}

		const indices: number[] = [];
		for (let i = 0; i < blocks.length; i++) {
			if (blocks[i].type === BlockType.video) {
				indices.push(i);
			}
		}

		return indices.length > 0 ? indices : undefined;
	}, [blocks]);

	return (
		<View style={styles.container}>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				ref={scrollViewRef}
				keyboardShouldPersistTaps="handled"
				scrollEventThrottle={16}
				stickyHeaderIndices={stickyHeaderIndices}
				onScroll={(e) => {
					updateScrollY(e.nativeEvent.contentOffset.y);
				}}
				onLayout={(e) => {
					updateViewHeight(e.nativeEvent.layout.height);
				}}
			>
				{blockIds.map((id, index) => (
					<BlockRow key={id} index={index} handlers={handlers} />
				))}
				<Pressable
					style={styles.pressableArea}
					onPress={() => {
						const blocks = useEditorState.getState().document.blocks;
						const lastIndex = Math.max(0, blocks.length - 1);
						focusBlock(lastIndex);
					}}
				/>
			</ScrollView>
			<WikiLinkModal />
			<WikiLinkActions onOpenWikiLink={handleOpenWikiLink} />
			<SlashCommandModal />
		</View>
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
		width: "100%",
		paddingBottom: 20,
	},
	pressableArea: {
		flexGrow: 1,
		minHeight: 120,
	},
});
