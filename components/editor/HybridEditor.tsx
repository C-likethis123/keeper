import { ScrollView } from "@/components/shared/ScrollView";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import {
	useEditorDocument,
	useEditorSelection,
	useEditorState,
} from "@/stores/editorStore";
import { flip, shift, useFloating } from "@floating-ui/react-native";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef } from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { type BlockConfig, blockRegistry } from "./blocks/BlockRegistry";
import {
	type BlockNode,
	BlockType,
	createParagraphBlock,
	getListLevel,
} from "./core/BlockNode";
import { WikiLinkOverlay } from "./wikilinks/WikiLinkOverlay";
import { useWikiLinks } from "./wikilinks/useWikiLinks";

export interface HybridEditorProps {
	initialContent?: string;
	onChanged?: (markdown: string) => void;
}

/// A hybrid markdown/code editor widget
///
/// Features:
/// - Block-based editing with markdown support
/// - Inline markdown formatting (bold, italic, code, links)
/// - Keyboard shortcuts
/// - Undo/redo support
export function HybridEditor({
	initialContent = "",
	onChanged,
}: HybridEditorProps) {
	const document = useEditorDocument();
	const selection = useEditorSelection();
	const toMarkdown = useEditorState((s) => s.toMarkdown);
	const loadMarkdown = useEditorState((s) => s.loadMarkdown);
	const setSelection = useEditorState((s) => s.setSelection);
	const updateBlockType = useEditorState((s) => s.updateBlockType);
	const splitBlock = useEditorState((s) => s.splitBlock);
	const deleteBlock = useEditorState((s) => s.deleteBlock);
	const mergeWithPrevious = useEditorState((s) => s.mergeWithPrevious);
	const toggleCheckbox = useEditorState((s) => s.toggleCheckbox);
	const getFocusedBlock = useEditorState((s) => s.getFocusedBlock);
	const insertBlockAfter = useEditorState((s) => s.insertBlockAfter);
	const updateBlockContent = useEditorState((s) => s.updateBlockContent);
	const lastInitialContentRef = useRef<string | undefined>(undefined);
	const lastEmittedMarkdownRef = useRef<string | undefined>(undefined);
	const isInitializedRef = useRef(false);
	const ignoreNextContentChangeRef = useRef<number | null>(null);
	const ignoreSelectionChangeUntilRef = useRef(0);

	// Wiki link management via hook
	const wikiLinks = useWikiLinks();

	const {
		refs,
		floatingStyles,
		scrollProps,
		update: updateFloatingPosition,
	} = useFloating({
		placement: "bottom",
		middleware: [flip(), shift()],
		sameScrollView: false,
	});

	// Focus management
	const { focusBlock, blurBlock, focusBlockIndex } = useFocusBlock();

	const handleLinkPress = useCallback(
		(index: number) => (urlOrWikiTitle: string) => {
			const isUrl =
				urlOrWikiTitle.startsWith("http://") ||
				urlOrWikiTitle.startsWith("https://");
			if (isUrl) {
				Alert.alert("Link", urlOrWikiTitle, [
					{
						text: "Open",
						onPress: () => {
							if (Platform.OS === "web") {
								window.open(urlOrWikiTitle, "_blank");
							} else {
								WebBrowser.openBrowserAsync(urlOrWikiTitle).catch(() => {});
							}
						},
					},
					{ text: "Edit", onPress: () => focusBlock(index) },
					{ text: "Cancel", style: "cancel" },
				]);
			} else {
				focusBlock(index);
			}
		},
		[focusBlock],
	);

	// Track if a selection is in progress to prevent blur from ending session
	const wikiLinkSelectionInProgressRef = useRef(false);

	// Notify parent of changes. Only after we've applied initialContent (lastInitialContentRef set by init effect), so we never emit the initial empty document and overwrite the parent's note.
	useEffect(() => {
		if (onChanged && lastInitialContentRef.current !== undefined) {
			const markdown = toMarkdown();
			lastEmittedMarkdownRef.current = markdown;
			onChanged(markdown);
		}
	}, [onChanged, toMarkdown]);

	// Initialize document from markdown when initialContent changes (only from outside, not from our own updates).
	// Depends only on initialContent so we do not re-run after our own loadMarkdown (which would change editorState and cause an update loop).
	useEffect(() => {
		// Do not run when initialContent is unchanged (effect ran only due to editorState/typing); avoids loading stale content and flicker.
		if (initialContent === lastInitialContentRef.current) {
			return;
		}
		// Skip reload when initialContent came from our own onChanged (parent echoed back)
		if (initialContent === lastEmittedMarkdownRef.current) {
			lastInitialContentRef.current = initialContent;
			return;
		}
		if (initialContent !== undefined) {
			const currentMarkdown = toMarkdown();
			if (currentMarkdown !== initialContent) {
				loadMarkdown(initialContent);
				isInitializedRef.current = true;
			}
			lastInitialContentRef.current = initialContent;
		}
	}, [initialContent, toMarkdown, loadMarkdown]);

	const handleContentChange = useCallback(
		(index: number) => (content: string) => {
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
		(index: number) => () => {
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
		(index: number) => () => {
			const block = getFocusedBlock();
			if (!block) {
				return;
			}
			const prevBlock = index > 0 ? document.blocks[index - 1] : null;

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
			document,
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
			// Handle wiki link selection if active
			if (wikiLinks.isActive) {
				const selected = wikiLinks.getSelectedResult();
				if (selected) {
					wikiLinks.handleSelect(selected, index, updateBlockContent);
					return;
				}
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

			// Set ignore flag before splitting to prevent TextInput from updating old block
			ignoreNextContentChangeRef.current = index;
			ignoreSelectionChangeUntilRef.current = Date.now() + 150;
			splitBlock(index, cursorOffset);
			focusBlock(index + 1);
		},
		[
			wikiLinks,
			updateBlockContent,
			handleBlockTypeDetection,
			focusBlock,
			updateBlockType,
			splitBlock,
			getFocusedBlock,
		],
	);

	const handleSelectionChange = useCallback(
		(index: number) => (start: number, end: number) => {
			if (Date.now() < ignoreSelectionChangeUntilRef.current) {
				return;
			}
			const cur = selection;
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
		[setSelection, selection],
	);

	const calculateListItemNumber = useCallback(
		(index: number): number | undefined => {
			const block = getFocusedBlock();
			if (!block) {
				return undefined;
			}
			if (block.type !== BlockType.numberedList) {
				return undefined;
			}

			const listLevel = getListLevel(block);
			let number = 1;
			for (let i = index - 1; i >= 0; i--) {
				const prevBlock = document.blocks[i];
				if (
					prevBlock.type !== BlockType.numberedList ||
					getListLevel(prevBlock) < listLevel
				) {
					break;
				}
				if (
					prevBlock.type === BlockType.numberedList &&
					getListLevel(prevBlock) === listLevel
				) {
					number++;
				}
			}
			return number;
		},
		[document.blocks, getFocusedBlock],
	);

	const renderBlock = useCallback(
		(block: BlockNode, index: number) => {
			const listItemNumber = calculateListItemNumber(index);
			const config: BlockConfig = {
				block,
				index,
				isFocused: focusBlockIndex === index,
				onContentChange: handleContentChange(index),
				onBlockTypeChange: (
					blockIndex: number,
					newType: BlockType,
					language?: string,
				) => {
					if (blockIndex === index) {
						handleBlockTypeChange(index, newType, language);
					}
				},
				onBackspaceAtStart: handleBackspaceAtStart(index),
				onSpace: handleSpace(index),
				onEnter: (cursorOffset) => handleEnter(index, cursorOffset),
				onSelectionChange: handleSelectionChange(index),
				onDelete: () => handleDelete(index),
				listItemNumber,
				onCheckboxToggle: (blockIndex) => toggleCheckbox(blockIndex),
				onWikiLinkTriggerStart: wikiLinks.handleTriggerStart,
				onWikiLinkQueryUpdate: wikiLinks.handleQueryUpdate,
				onWikiLinkTriggerEnd: wikiLinks.handleTriggerEnd,
			};
			return (
				<View key={block.id} style={styles.blockWrapper}>
					{blockRegistry.build(config)}
				</View>
			);
		},
		[
			focusBlockIndex,
			toggleCheckbox,
			handleContentChange,
			handleBlockTypeChange,
			handleBackspaceAtStart,
			handleSpace,
			handleSelectionChange,
			handleEnter,
			handleDelete,
			calculateListItemNumber,
			wikiLinks.handleTriggerStart,
			wikiLinks.handleQueryUpdate,
			wikiLinks.handleTriggerEnd,
		],
	);

	const showWikiLinkOverlay = wikiLinks.isActive;
	const overlayWrapperRef = useRef<View>(null);

	useEffect(() => {
		if (!showWikiLinkOverlay) return;
		const id = requestAnimationFrame(() => {
			updateFloatingPosition();
		});
		return () => cancelAnimationFrame(id);
	}, [showWikiLinkOverlay, updateFloatingPosition]);

	return (
		<View style={styles.container}>
			<ScrollView contentContainerStyle={styles.scrollContent} {...scrollProps}>
				<Pressable
					style={styles.pressableArea}
					onPress={() => {
						const lastIndex = document.blocks.length - 1;
						focusBlock(lastIndex);
					}}
				>
					{document.blocks.map((block, index) => {
						const blockElement = renderBlock(block, index);
						const isFocusedBlock = index === focusBlockIndex;
						return (
							<View
								key={block.id}
								style={styles.blockWrapper}
								ref={isFocusedBlock ? refs.setReference : undefined}
								collapsable={isFocusedBlock ? false : undefined}
							>
								{blockElement}
							</View>
						);
					})}
				</Pressable>
			</ScrollView>
			{/* Render overlay outside ScrollView to prevent touch conflicts */}
			{showWikiLinkOverlay && (
				<View
					ref={overlayWrapperRef}
					style={styles.overlayWrapper}
					pointerEvents="box-none"
					collapsable={false}
				>
					<View
						ref={refs.setFloating}
						style={floatingStyles}
						collapsable={false}
						pointerEvents="auto"
					>
						<WikiLinkOverlay
							results={wikiLinks.results}
							selectedIndex={wikiLinks.selectedIndex}
							isLoading={wikiLinks.isLoading}
							query={wikiLinks.query}
							onSelect={(title) => {
								wikiLinkSelectionInProgressRef.current = true;
								wikiLinks.handleSelect(
									title,
									focusBlockIndex ?? 0,
									updateBlockContent,
								);
							}}
						/>
					</View>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		position: "relative",
	},
	overlayWrapper: {
		position: "absolute",
		zIndex: 1000,
		elevation: 10,
		top: 0,
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
	blockWrapper: {
		width: "100%",
	},
});

// Enable why-did-you-render tracking for debugging
HybridEditor.displayName = "HybridEditor";
HybridEditor.whyDidYouRender = true;
