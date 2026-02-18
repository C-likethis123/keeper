import { useEditorState } from "@/contexts/EditorContext";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useOverlayPosition } from "@/hooks/useOverlayPosition";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	Alert,
	Keyboard,
	Platform,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type BlockConfig, blockRegistry } from "./blocks/BlockRegistry";
import {
	BlockType,
	createParagraphBlock
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
	const editorState = useEditorState();
	const lastInitialContentRef = useRef<string | undefined>(undefined);
	const lastEmittedMarkdownRef = useRef<string | undefined>(undefined);
	const isInitializedRef = useRef(false);
	const ignoreNextContentChangeRef = useRef<number | null>(null);
	const ignoreSelectionChangeUntilRef = useRef(0);

	// Wiki link management via hook
	const wikiLinks = useWikiLinks();

	// Overlay positioning
	const overlayPosition = useOverlayPosition({
		strategy: "center",
		zIndex: 1000,
		elevation: 10,
	});

	// Focus management
	const { focusBlock, blurBlock } = useFocusBlock();

	const insets = useSafeAreaInsets();
	const [keyboardHeight, setKeyboardHeight] = useState(0);

	useEffect(() => {
		if (Platform.OS === "web") return;
		const showSub = Keyboard.addListener("keyboardDidShow", (e) =>
			setKeyboardHeight(e.endCoordinates.height),
		);
		const hideSub = Keyboard.addListener("keyboardDidHide", () =>
			setKeyboardHeight(0),
		);
		return () => {
			showSub.remove();
			hideSub.remove();
		};
	}, []);

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

	// Initialize document from markdown when initialContent changes (only from outside, not from our own updates)
	useEffect(() => {
		// Skip reload when initialContent came from our own onChanged (parent echoed back)
		if (initialContent === lastEmittedMarkdownRef.current) {
			lastInitialContentRef.current = initialContent;
			return;
		}
		if (
			initialContent !== undefined &&
			initialContent !== lastInitialContentRef.current
		) {
			const currentMarkdown = editorState.toMarkdown();
			if (currentMarkdown !== initialContent) {
				editorState.loadMarkdown(initialContent);
				lastInitialContentRef.current = initialContent;
				isInitializedRef.current = true;
			}
		}
	}, [initialContent]);

	// Notify parent of changes
	useEffect(() => {
		if (onChanged) {
			const markdown = editorState.toMarkdown();
			lastEmittedMarkdownRef.current = markdown;
			onChanged(markdown);
		}
	}, [editorState.document, onChanged, editorState]);

	const handleContentChange = useCallback(
		(index: number) => (content: string) => {
			if (ignoreNextContentChangeRef.current === index) {
				ignoreNextContentChangeRef.current = null;
				return;
			}
			editorState.updateBlockContent(index, content);
		},
		[editorState],
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
			const block = editorState.document.blocks[index];
			const detection = blockRegistry.detectBlockType(content);

			if (!detection) {
				return false;
			}

			// If onlyIfTypeChanges is true, check if type would actually change
			if (options?.onlyIfTypeChanges && block.type === detection.type) {
				return false;
			}

			// Update block type and content
			editorState.updateBlockType(index, detection.type, detection.language);
			editorState.updateBlockContent(index, detection.remainingContent);

			if (
				detection.type === BlockType.mathBlock ||
				detection.type === BlockType.codeBlock
			) {
				editorState.insertBlockAfter(index, createParagraphBlock());
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
		[editorState, focusBlock],
	);

	const handleBlockTypeChange = useCallback(
		(index: number, newType: BlockType, language?: string) => {
			editorState.updateBlockType(index, newType, language);
			focusBlock(index);
		},
		[editorState, focusBlock],
	);

	const handleDelete = useCallback(
		(index: number) => {
			editorState.deleteBlock(index);
			focusBlock(index > 0 ? index - 1 : 0);
		},
		[editorState, focusBlock],
	);

	const handleSpace = useCallback(
		(index: number) => () => {
			const block = editorState.document.blocks[index];
			// Get current content and add space (space key was just pressed)
			const newContent = `${block.content} `;

			if (
				!handleBlockTypeDetection(index, newContent, {
					ignoreContentChange: true,
				})
			) {
				editorState.updateBlockContent(index, newContent);
			}
		},
		[editorState, handleBlockTypeDetection],
	);

	const handleBackspaceAtStart = useCallback(
		(index: number) => () => {
			const block = editorState.document.blocks[index];
			const prevBlock =
				index > 0 ? editorState.document.blocks[index - 1] : null;

			// If it's a non-paragraph block (except code block and math block), convert to paragraph
			if (
				![
					BlockType.paragraph,
					BlockType.codeBlock,
					BlockType.mathBlock,
				].includes(block.type)
			) {
				editorState.updateBlockType(index, BlockType.paragraph);
				focusBlock(index);
				return;
			}

			// If it's an empty paragraph, delete and focus previous/next
			if (block.content === "") {
				editorState.deleteBlock(index);
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
				editorState.mergeWithPrevious(index);
				focusBlock(index - 1);
			}
		},
		[editorState, focusBlock],
	);

	const handleEnter = useCallback(
		(index: number, cursorOffset: number) => {
			const block = editorState.document.blocks[index];
			if ([BlockType.codeBlock, BlockType.mathBlock].includes(block.type)) {
				return;
			}
			// Handle wiki link selection if active
			if (wikiLinks.isActiveFor(index)) {
				const selected = wikiLinks.getSelectedResult();
				if (selected) {
					wikiLinks.handleSelect(
						selected,
						index,
						editorState.updateBlockContent,
					);
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
			if (block.content.trim() === "" && [BlockType.numberedList, BlockType.bulletList].includes(block.type)) {
				editorState.updateBlockType(index, BlockType.paragraph);
				focusBlock(index);
				return;
			}

			// Set ignore flag before splitting to prevent TextInput from updating old block
			ignoreNextContentChangeRef.current = index;

			// Blur current block first to prevent it from processing the Enter key
			ignoreSelectionChangeUntilRef.current = Date.now() + 150;
			blurBlock();
			editorState.splitBlock(index, cursorOffset);
			focusBlock(index + 1);
		},
		[editorState, wikiLinks, handleBlockTypeDetection, focusBlock, blurBlock],
	);

	const handleSelectionChange = useCallback(
		(index: number) => (start: number, end: number) => {
			if (Date.now() < ignoreSelectionChangeUntilRef.current) {
				return;
			}
			editorState.setSelection({
				anchor: { blockIndex: index, offset: start },
				focus: { blockIndex: index, offset: end },
			});
		},
		[editorState],
	);

	const calculateListItemNumber = useCallback(
		(index: number): number | undefined => {
			const block = editorState.document.blocks[index];
			if (block.type !== BlockType.numberedList) {
				return undefined;
			}

			const listLevel = block.listLevel;
			// Count consecutive numbered lists before this one
			let number = 1;
			for (let i = index - 1; i >= 0; i--) {
				const prevBlock = editorState.document.blocks[i];
				if (
					prevBlock.type !== BlockType.numberedList ||
					prevBlock.listLevel < listLevel
				) {
					break;
				}
				if (
					prevBlock.type === BlockType.numberedList &&
					prevBlock.listLevel === listLevel
				) {
					number++;
				}
			}
			return number;
		},
		[editorState.document.blocks],
	);

	const renderBlock = useCallback(
		(block: (typeof editorState.document.blocks)[0], index: number) => {
			const listItemNumber = calculateListItemNumber(index);
			const config: BlockConfig = {
				block,
				index,
				isFocused: editorState.getFocusedBlockIndex() === index,
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
				onWikiLinkTriggerStart: (startOffset) =>
					wikiLinks.handleTriggerStart(index, startOffset),
				onWikiLinkQueryUpdate: (query, caretOffset) =>
					wikiLinks.handleQueryUpdate(index, query, caretOffset),
				onWikiLinkTriggerEnd: wikiLinks.handleTriggerEnd,
			};
			return (
				<View key={block.id} style={styles.blockWrapper}>
					{blockRegistry.build(config)}
				</View>
			);
		},
		[
			editorState,
			handleContentChange,
			handleBlockTypeChange,
			handleBackspaceAtStart,
			handleSpace,
			handleSelectionChange,
			handleEnter,
			handleDelete,
			calculateListItemNumber,
			handleLinkPress,
			wikiLinks.handleTriggerStart,
			wikiLinks.handleQueryUpdate,
			wikiLinks.handleTriggerEnd,
		],
	);

	const showWikiLinkOverlay = wikiLinks.shouldShowOverlay;

	return (
		<View style={styles.container}>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{
						paddingBottom:
							20 + insets.bottom + keyboardHeight,
					},
				]}
				keyboardShouldPersistTaps="handled"
			>
				{editorState.document.blocks.map((block, index) => {
					const blockElement = renderBlock(block, index);
					return (
						<View key={block.id} style={styles.blockWrapper}>
							{blockElement}
						</View>
					);
				})}
			</ScrollView>
			{/* Render overlay outside ScrollView to prevent touch conflicts */}
			{showWikiLinkOverlay && wikiLinks.session && (
				<View
					style={overlayPosition.wrapperStyle}
					{...overlayPosition.wrapperProps}
				>
					<View
						style={overlayPosition.containerStyle}
						{...overlayPosition.containerProps}
					>
						<WikiLinkOverlay
							results={wikiLinks.results}
							selectedIndex={wikiLinks.selectedIndex}
							isLoading={wikiLinks.isLoading}
							onSelect={(title) => {
								wikiLinkSelectionInProgressRef.current = true;
								wikiLinks.handleSelect(
									title,
									wikiLinks.session!.blockIndex,
									editorState.updateBlockContent,
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
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingBottom: 20,
	},
	blockWrapper: {
		width: "100%",
	},
});

// Enable why-did-you-render tracking for debugging
HybridEditor.displayName = "HybridEditor";
HybridEditor.whyDidYouRender = true;
