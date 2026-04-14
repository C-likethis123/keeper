import { useEditorScrollView } from "@/components/editor/EditorScrollContext";
import { useEditorCommandContext } from "@/components/editor/keyboard/useEditorCommandContext";
import { useEditorKeyboardShortcuts } from "@/components/editor/keyboard/useEditorKeyboardShortcuts";
import {
	runBackspaceChain,
	type BackspaceCommandContext,
} from "@/components/editor/keyboard/backspaceCommands";
import {
	runEnterChain,
	type EnterCommandContext,
} from "@/components/editor/keyboard/enterCommands";
import {
	buildTrackedTodoTitle,
	extractWikiLinkTitle,
	resolveOrCreateTrackedTodoNoteId,
	resolveOrCreateWikiLinkNoteId,
	updateLinkedTodoNoteStatus,
} from "@/components/editor/wikilinks/wikiLinkUtils";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorBlockIds, useEditorState } from "@/stores/editorStore";
import { useTabStore } from "@/stores/tabStore";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import {
	runOnJS,
	useAnimatedReaction,
	useSharedValue,
} from "react-native-reanimated";
import { BlockRow } from "./BlockRow";
import { blockRegistry } from "./blocks/BlockRegistry";
import {
	BlockType,
	createCheckboxBlock,
	createParagraphBlock,
	getListLevel,
} from "./core/BlockNode";
import { createCollapsedSelection } from "./core/Selection";
import { TransactionBuilder } from "./core/Transaction";
import {
	SlashCommandProvider,
	useSlashCommandContext,
} from "./slash-commands/SlashCommandContext";
import { SlashCommandModal } from "./slash-commands/SlashCommandModal";
import { parseTodoTrigger } from "./todoTrigger";
import { WikiLinkActions } from "./wikilinks/WikiLinkActions";
import {
	WikiLinkProvider,
	useWikiLinkContext,
} from "./wikilinks/WikiLinkContext";
import { WikiLinkModal } from "./wikilinks/WikiLinkModal";

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
	const clearStructuredSelectionState = useEditorState(
		(s) => s.clearStructuredSelection,
	);
	const selectBlockState = useEditorState((s) => s.selectBlock);
	const selectBlockRangeState = useEditorState((s) => s.selectBlockRange);
	const updateBlockType = useEditorState((s) => s.updateBlockType);
	const splitBlock = useEditorState((s) => s.splitBlock);
	const deleteBlock = useEditorState((s) => s.deleteBlock);
	const mergeWithPrevious = useEditorState((s) => s.mergeWithPrevious);
	const toggleCheckbox = useEditorState((s) => s.toggleCheckbox);
	const getFocusedBlock = useEditorState((s) => s.getFocusedBlock);
	const insertBlockAfter = useEditorState((s) => s.insertBlockAfter);
	const moveBlock = useEditorState((s) => s.moveBlock);
	const updateBlockContent = useEditorState((s) => s.updateBlockContent);
	const updateBlockAttributes = useEditorState((s) => s.updateBlockAttributes);
	const ignoreNextContentChangeRef = useRef<number | null>(null);
	const ignoreSelectionChangeUntilRef = useRef(0);
	const lastSelectionOffsetRef = useRef(0);

	const [isDragging, setIsDragging] = useState(false);
	const activeDragIndex = useSharedValue<number | null>(null);
	const dropIndex = useSharedValue<number | null>(null);
	const draggedBlockHeight = useSharedValue(0);
	const dragAbsoluteY = useSharedValue(0);
	const dragStartY = useSharedValue(0);
	const blockLayouts = useRef<Map<number, { y: number; height: number }>>(
		new Map(),
	);

	const handleDragStart = useCallback(
		(index: number, absoluteY: number) => {
			activeDragIndex.value = index;
			dropIndex.value = index;
			const layout = blockLayouts.current.get(index);
			if (layout) {
				draggedBlockHeight.value = layout.height;
			}
			setIsDragging(true);
			dragStartY.value = absoluteY;
			dragAbsoluteY.value = absoluteY;
		},
		[activeDragIndex, dragAbsoluteY, dragStartY, dropIndex, draggedBlockHeight],
	);

	const handleDragUpdate = useCallback(
		(absoluteY: number) => {
			dragAbsoluteY.value = absoluteY;

			if (activeDragIndex.value === null) return;

			const currentY = absoluteY;
			const deltaY = currentY - dragStartY.value;

			const draggedIdx = activeDragIndex.value;
			const draggedBlockLayout = blockLayouts.current.get(draggedIdx);
			if (!draggedBlockLayout) return;

			const targetScrollRelativeY = draggedBlockLayout.y + deltaY;

			let nextDropIndex = draggedIdx;
			let minDistance = Number.MAX_VALUE;

			for (const [idx, layout] of blockLayouts.current.entries()) {
				const centerY = layout.y + layout.height / 2;
				const distance = Math.abs(
					targetScrollRelativeY + draggedBlockLayout.height / 2 - centerY,
				);
				if (distance < minDistance) {
					minDistance = distance;
					nextDropIndex = idx;
				}
			}

			if (nextDropIndex !== dropIndex.value) {
				dropIndex.value = nextDropIndex;
			}
		},
		[activeDragIndex, dragAbsoluteY, dragStartY, dropIndex],
	);

	const handleDragEnd = useCallback(() => {
		if (activeDragIndex.value === null || dropIndex.value === null) return;

		const draggedIdx = activeDragIndex.value;
		const finalDropIndex = dropIndex.value;

		if (finalDropIndex !== draggedIdx) {
			moveBlock(draggedIdx, finalDropIndex);
		}

		activeDragIndex.value = null;
		dropIndex.value = null;
		setIsDragging(false);
	}, [activeDragIndex, dropIndex, moveBlock]);

	const handleLayout = useCallback(
		(index: number, y: number, height: number) => {
			blockLayouts.current.set(index, { y, height });
		},
		[],
	);

	const {
		scrollViewRef,
		updateScrollY,
		updateViewHeight,
		scrollYRef,
		viewHeightRef,
	} = useEditorScrollView();

	const scrollTo = useCallback(
		(offset: number) => {
			scrollViewRef.current?.scrollTo({ y: offset, animated: false });
		},
		[scrollViewRef],
	);

	useAnimatedReaction(
		() => {
			if (activeDragIndex.value === null) return null;
			return {
				y: dragAbsoluteY.value,
				scrollY: scrollYRef.current,
				viewHeight: viewHeightRef.current,
			};
		},
		(data) => {
			if (!data) return;
			const { y, scrollY, viewHeight } = data;
			const SCROLL_THRESHOLD = 50;
			const SCROLL_STEP = 10;

			if (y < SCROLL_THRESHOLD) {
				runOnJS(scrollTo)(Math.max(0, scrollY - SCROLL_STEP));
			} else if (y > viewHeight - SCROLL_THRESHOLD) {
				runOnJS(scrollTo)(scrollY + SCROLL_STEP);
			}
		},
		[scrollTo, scrollYRef, viewHeightRef],
	);

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

	const syncTrackedTodoLink = useCallback(
		async (index: number, blockId: string, todoBody: string) => {
			try {
				const todoNoteId = await resolveOrCreateTrackedTodoNoteId(todoBody);
				if (!todoNoteId) {
					return;
				}

				const latestBlock = useEditorState.getState().document.blocks[index];
				if (
					!latestBlock ||
					latestBlock.id !== blockId ||
					latestBlock.type !== BlockType.checkboxList
				) {
					return;
				}

				if (latestBlock.attributes?.linkedNoteId === todoNoteId) {
					return;
				}

				useEditorState.getState().updateBlockAttributes(index, {
					...latestBlock.attributes,
					linkedNoteId: todoNoteId,
				});
			} catch (error) {
				console.warn("Failed to link tracked todo note:", error);
			}
		},
		[],
	);

	const convertTodoBlock = useCallback(
		(
			index: number,
			options?: {
				insertNextBlock?: boolean;
			},
		) => {
			const state = useEditorState.getState();
			const block = state.document.blocks[index];
			if (
				!block ||
				!(
					block.type === BlockType.paragraph ||
					block.type === BlockType.bulletList ||
					block.type === BlockType.numberedList
				)
			) {
				return false;
			}

			const todoMatch = parseTodoTrigger(block.content);
			if (!todoMatch) {
				return false;
			}

			const trackedTitle = buildTrackedTodoTitle(todoMatch.body);
			const nextBlockContent = `[[${trackedTitle}]]`;
			const selectionBefore = state.selection;
			const selectionAfter = createCollapsedSelection({
				blockIndex: index,
				offset: nextBlockContent.length,
			});
			const listLevel =
				block.type === BlockType.paragraph ? 0 : getListLevel(block);
			let builder = new TransactionBuilder()
				.updateType(index, block.type, BlockType.checkboxList)
				.updateContent(index, block.content, nextBlockContent)
				.updateBlockAttributes(index, block.attributes ?? {}, {
					...block.attributes,
					listLevel,
					checked: false,
				})
				.withSelectionBefore(selectionBefore)
				.withDescription("Create tracked todo");

			if (options?.insertNextBlock) {
				builder = builder
					.insertBlock(index + 1, createCheckboxBlock("", listLevel, false))
					.withSelectionAfter(
						createCollapsedSelection({
							blockIndex: index + 1,
							offset: 0,
						}),
					);
			} else {
				builder = builder.withSelectionAfter(selectionAfter);
			}

			useEditorState.getState().applyTransaction(builder.build());
			ignoreSelectionChangeUntilRef.current = Date.now() + 150;

			if (options?.insertNextBlock) {
				focusBlock(index + 1);
			} else {
				focusBlock(index);
			}

			void syncTrackedTodoLink(index, block.id, todoMatch.body);
			return true;
		},
		[focusBlock, syncTrackedTodoLink],
	);

	const getBlockAtIndex = useCallback((index: number) => {
		return useEditorState.getState().document.blocks[index] ?? null;
	}, []);

	const maybeConvertTrackedTodo = useCallback(
		(
			index: number,
			options?: {
				insertNextBlock?: boolean;
			},
		) => {
			const block = useEditorState.getState().document.blocks[index];
			if (
				!block ||
				!(
					block.type === BlockType.paragraph ||
					block.type === BlockType.bulletList ||
					block.type === BlockType.numberedList
				)
			) {
				return false;
			}

			if (!parseTodoTrigger(block.content)) {
				return false;
			}

			return convertTodoBlock(index, options);
		},
		[convertTodoBlock],
	);

	const handleContentChange = useCallback(
		(index: number, content: string) => {
			if (ignoreNextContentChangeRef.current === index) {
				ignoreNextContentChangeRef.current = null;
				return;
			}
			const state = useEditorState.getState();
			const oldContent = state.document.blocks[index]?.content ?? "";
			const delta = content.length - oldContent.length;
			// Read cursor position directly from store selection instead of
			// relying on a ref that can become stale when focus moves between blocks
			const currentSelection = state.selection;
			const currentOffset =
				currentSelection?.focus.blockIndex === index
					? currentSelection.focus.offset
					: oldContent.length;
			const newCursor = Math.max(
				0,
				Math.min(content.length, currentOffset + delta),
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

	const selectBlock = useCallback(
		(index: number) => {
			selectBlockState(index);
		},
		[selectBlockState],
	);

	const selectBlockRange = useCallback(
		(index: number) => {
			const state = useEditorState.getState();
			const anchor =
				state.blockSelectionAnchor ?? state.blockSelection?.start ?? index;
			selectBlockRangeState(anchor, index);
		},
		[selectBlockRangeState],
	);

	const clearStructuredSelection = useCallback(() => {
		clearStructuredSelectionState();
	}, [clearStructuredSelectionState]);

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
			if (!block) return;
			const prevBlock =
				index > 0
					? useEditorState.getState().document.blocks[index - 1]
					: null;

			const ctx: BackspaceCommandContext = {
				index,
				block,
				prevBlock,
				updateBlockType: (i, type) => updateBlockType(i, type),
				deleteBlock,
				mergeWithPrevious,
				focusBlock,
			};
			runBackspaceChain(ctx);
		},
		[focusBlock, deleteBlock, getBlockAtIndex, mergeWithPrevious, updateBlockType],
	);

	const handleEnter = useCallback(
		(index: number, cursorOffset: number, zone?: string) => {
			const block = getBlockAtIndex(index);
			if (!block) return;

			const ctx: EnterCommandContext = {
				index,
				cursorOffset,
				zone: zone as "summary" | "body" | undefined,
				block,
				getBlockAtIndex,
				detectBlockType: handleBlockTypeDetection,
				convertTrackedTodo: maybeConvertTrackedTodo,
				updateBlockType: (i, type) => updateBlockType(i, type),
				focusBlock,
				splitBlock,
				insertBlockAfter,
				setBlockContent: handleContentChange,
			};
			runEnterChain(ctx);
		},
		[
			handleBlockTypeDetection,
			maybeConvertTrackedTodo,
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

	const handleBlockExit = useCallback(
		(index: number) => {
			maybeConvertTrackedTodo(index);
		},
		[maybeConvertTrackedTodo],
	);

	const handleOpenWikiLink = useCallback(
		async (title: string) => {
			const noteId = await resolveOrCreateWikiLinkNoteId(title);
			if (!noteId) {
				return;
			}

			useTabStore.getState().openTab(noteId, title);
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

	const handleCheckboxToggle = useCallback(
		(index: number) => {
			const block = useEditorState.getState().document.blocks[index];
			if (!block || block.type !== BlockType.checkboxList) {
				return;
			}

			const nextChecked = !block.attributes?.checked;
			toggleCheckbox(index);

			const linkedTitle = extractWikiLinkTitle(block.content);
			const linkedNoteId =
				typeof block.attributes?.linkedNoteId === "string"
					? block.attributes.linkedNoteId
					: null;
			if (!linkedTitle) {
				return;
			}

			void (async () => {
				try {
					const resolvedTodo =
						linkedNoteId == null
							? await resolveOrCreateTrackedTodoNoteId(
									linkedTitle.replace(/^todo:\s*/i, ""),
								)
							: null;
					const noteId = linkedNoteId ?? resolvedTodo ?? null;
					if (!noteId) {
						return;
					}

					if (!linkedNoteId) {
						const latestBlock =
							useEditorState.getState().document.blocks[index];
						if (latestBlock?.type === BlockType.checkboxList) {
							useEditorState.getState().updateBlockAttributes(index, {
								...latestBlock.attributes,
								linkedNoteId: noteId,
							});
						}
					}

					await updateLinkedTodoNoteStatus(
						noteId,
						linkedTitle,
						nextChecked ? "done" : "open",
					);
				} catch (error) {
					console.warn("Failed to sync linked todo status:", error);
				}
			})();
		},
		[toggleCheckbox],
	);

	const handlers = React.useMemo(
		() => ({
			onContentChange: handleContentChange,
			onBlockTypeChange: handleBlockTypeChange,
			onAttributesChange: handleAttributesChange,
			onBackspaceAtStart: handleBackspaceAtStart,
			onSpace: handleSpace,
			onEnter: handleEnter,
			onBlockExit: handleBlockExit,
			onSelectionChange: handleSelectionChange,
			onDelete: handleDelete,
			onCheckboxToggle: handleCheckboxToggle,
			onOpenWikiLink: handleOpenWikiLink,
			onSelectBlock: selectBlock,
			onSelectBlockRange: selectBlockRange,
			onClearStructuredSelection: clearStructuredSelection,
			onDragStart: handleDragStart,
			onDragUpdate: handleDragUpdate,
			onDragEnd: handleDragEnd,
			onLayout: handleLayout,
		}),
		[
			handleContentChange,
			handleBlockTypeChange,
			handleAttributesChange,
			handleBackspaceAtStart,
			handleSpace,
			handleEnter,
			handleBlockExit,
			handleSelectionChange,
			handleDelete,
			handleCheckboxToggle,
			handleOpenWikiLink,
			selectBlock,
			selectBlockRange,
			clearStructuredSelection,
			handleDragStart,
			handleDragUpdate,
			handleDragEnd,
			handleLayout,
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
					<BlockRow
						key={id}
						index={index}
						handlers={handlers}
						activeDragIndex={activeDragIndex}
						dropIndex={dropIndex}
						draggedBlockHeight={draggedBlockHeight}
						dragAbsoluteY={dragAbsoluteY}
						dragStartY={dragStartY}
					/>
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
