import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorSelection, useEditorState } from "@/stores/editorStore";
import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import {
	type NativeMethods,
	type NativeSyntheticEvent,
	Platform,
	Pressable,
	StyleSheet,
	TextInput,
	type TextInputKeyPressEventData,
	type TextInputSelectionChangeEventData,
	type TextStyle,
	View,
} from "react-native";
import { useEditorScrollView } from "../EditorScrollContext";
import { BlockType, getListLevel, isListItem } from "../core/BlockNode";
import { InlineMarkdown } from "../rendering/InlineMarkdown";
import { useWikiLinkContext } from "../wikilinks/WikiLinkContext";
import { findWikiLinkTriggerStart } from "../wikilinks/WikiLinkTrigger";
import type { BlockConfig } from "./BlockRegistry";
import { ListMarker } from "./ListMarker";
export function UnifiedBlock({
	block,
	index,
	isFocused,
	onContentChange,
	onBackspaceAtStart,
	onSpace,
	onEnter,
	onSelectionChange,
	listItemNumber,
	onCheckboxToggle,
}: BlockConfig) {
	const { focusBlock, blurBlock } = useFocusBlock();
	const { scrollViewRef, scrollYRef, viewHeightRef } = useEditorScrollView();
	const inputRef = useRef<TextInput>(null);
	const ignoreNextChangeRef = useRef(false);
	const prevIsFocusedRef = useRef(false);
	const selection = useEditorSelection();
	const getFocusedBlockIndex = useEditorState(
		(state) => state.getFocusedBlockIndex,
	);

	useLayoutEffect(() => {
		if (isFocused && !prevIsFocusedRef.current && inputRef.current) {
			inputRef.current.focus();
			if (Platform.OS !== "web") {
				requestAnimationFrame(() => {
					const scrollView = scrollViewRef?.current;
					if (!inputRef.current || !scrollView) return;
					inputRef.current.measureLayout(
						// RN types lag behind runtime: cast needed for newer measureLayout API
						scrollView as unknown as NativeMethods,
						(_x: number, y: number, _w: number, h: number) => {
							const scrollY = scrollYRef.current;
							const viewHeight = viewHeightRef.current;
							if (y < scrollY) {
								scrollView.scrollTo({ y: Math.max(0, y - 20), animated: true });
							} else if (y + h > scrollY + viewHeight) {
								scrollView.scrollTo({
									y: y + h - viewHeight + 20,
									animated: true,
								});
							}
						},
						() => {},
					);
				});
			}
		}
		prevIsFocusedRef.current = isFocused;
	}, [isFocused, scrollViewRef, scrollYRef, viewHeightRef]);

	const handleFocus = useCallback(() => {
		focusBlock(index);
	}, [focusBlock, index]);

	const handleBlur = useCallback(() => {
		const currentFocus = getFocusedBlockIndex();
		if (currentFocus === index) {
			blurBlock();
		}
	}, [blurBlock, getFocusedBlockIndex, index]);

	const handleSelectionChange = useCallback(
		(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
			const { start, end } = e.nativeEvent.selection;
			onSelectionChange(index, start, end);
		},
		[index, onSelectionChange],
	);
	const wikiLinks = useWikiLinkContext();
	const handleContentChange = useCallback(
		(newText: string) => {
			// When we handle Enter to split the block, React Native's TextInput will still
			// emit an onChangeText with a newline. We want to ignore that one change,
			// because the actual split is handled via EditorState.splitBlock.
			if (ignoreNextChangeRef.current) {
				ignoreNextChangeRef.current = false;
				return;
			}

			onContentChange(index, newText);
			if (isFocused && inputRef.current) {
				const caret = newText.length;
				const start = findWikiLinkTriggerStart(newText, caret);
				if (start !== null) {
					wikiLinks.handleTriggerStart(index, start);
				} else {
					wikiLinks.handleCancel();
				}
			}
		},
		[
			index,
			onContentChange,
			isFocused,
			wikiLinks.handleTriggerStart,
			wikiLinks.handleCancel,
		],
	);

	const handleKeyPress = useCallback(
		(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
			const key = e.nativeEvent.key;

			// Handle space key - trigger block type detection for paragraph blocks
			if (key === " " && block.type === BlockType.paragraph) {
				onSpace(index);
				return;
			}

			// Handle Enter key - split non-code blocks at the current cursor position
			if (
				key === "Enter" &&
				selection?.anchor.offset === selection?.focus.offset
			) {
				if (block.type !== BlockType.codeBlock) {
					// Mark the next onChangeText as ignorable so the stray newline doesn't
					// get written back into the original block after we split.
					ignoreNextChangeRef.current = true;
					onEnter(index, selection?.focus.offset ?? 0);
				}
				return;
			}

			// Handle backspace at the start (position 0)
			if (
				key === "Backspace" &&
				selection?.anchor.offset === 0 &&
				selection?.focus.offset === 0
			) {
				// Paragraph blocks: delegate to editor-level handler (empty = delete, non-empty = merge or focus previous)
				if (block.type === BlockType.paragraph) {
					onBackspaceAtStart(index);
					return;
				}

				// Non-paragraph, non-code blocks (e.g., headings): convert to paragraph
				if (block.type !== BlockType.codeBlock) {
					onBackspaceAtStart(index);
				}
				return;
			}
		},
		[index, onSpace, onEnter, onBackspaceAtStart, selection, block.type],
	);

	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);

	// Compute text style based on block type
	const textStyle: TextStyle = useMemo(() => {
		switch (block.type) {
			case BlockType.heading1:
				return theme.typography.heading1;
			case BlockType.heading2:
				return theme.typography.heading2;
			case BlockType.heading3:
				return theme.typography.heading3;
			default:
				return theme.typography.body;
		}
	}, [block.type, theme.typography]);

	const selectionProp =
		isFocused && selection && selection.focus.blockIndex === index
			? (() => {
					const sel = selection;
					if (!sel) return undefined;
					const start = Math.min(sel.anchor.offset, sel.focus.offset);
					const end = Math.max(sel.anchor.offset, sel.focus.offset);
					const len = block.content.length;
					return {
						start: Math.min(start, len),
						end: Math.min(end, len),
					};
				})()
			: undefined;

	const textInputProps = {
		ref: inputRef,
		style: [
			styles.input,
			textStyle,
			isFocused ? styles.inputVisible : styles.inputHidden,
		],
		value: block.content,
		...(selectionProp !== undefined && { selection: selectionProp }),
		onChangeText: handleContentChange,
		onFocus: handleFocus,
		onBlur: handleBlur,
		onKeyPress: handleKeyPress,
		onSelectionChange: handleSelectionChange,
		multiline: true,
		placeholder: "Start typing...",
		placeholderTextColor: theme.custom.editor.placeholder,
	};

	const applyListStyles = isListItem(block.type);

	return (
		<Pressable
			style={({ pressed }) => [styles.container, pressed && styles.pressed]}
			onPress={handleFocus}
		>
			<View style={styles.row}>
				{applyListStyles && (
					<ListMarker
						type={
							block.type as
								| BlockType.bulletList
								| BlockType.numberedList
								| BlockType.checkboxList
						}
						listLevel={getListLevel(block)}
						listItemNumber={listItemNumber}
						checked={
							block.type === BlockType.checkboxList
								? !!block.attributes?.checked
								: undefined
						}
						onToggle={
							block.type === BlockType.checkboxList
								? () => onCheckboxToggle(index)
								: undefined
						}
					/>
				)}
				<View
					style={[
						{ flex: 1 },
						!isFocused
							? applyListStyles
								? styles.overlayContent
								: styles.overlay
							: { display: "none" },
					]}
					pointerEvents="none"
				>
					<InlineMarkdown text={block.content} style={textStyle} />
				</View>
				<TextInput
					{...textInputProps}
					textAlignVertical={applyListStyles ? undefined : "top"}
				/>
			</View>
		</Pressable>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			paddingVertical: 2,
			paddingHorizontal: 14,
			position: "relative",
		},
		pressed: {
			opacity: 0.8,
		},
		row: {
			flexDirection: "row",
			alignItems: "flex-start",
		},
		overlay: {
			alignItems: "flex-start",
		},
		overlayContent: {
			alignItems: "flex-start",
		},
		input: {
			flex: 1,
			padding: 0,
			paddingHorizontal: 2,
			color: theme.colors.text,
		},
		inputVisible: {
			opacity: 1,
		},
		inputHidden: {
			opacity: 0,
			height: 0,
		},
	});
}
