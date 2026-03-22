import { useVerticalArrowNavigation } from "@/components/editor/keyboard/useVerticalArrowNavigation";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorBlockSelection, useEditorState } from "@/stores/editorStore";
import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { GestureResponderEvent } from "react-native";
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
import {
	type WikiLinkActivationEvent,
	shouldOpenWikiLink,
	stopWikiLinkActivation,
} from "../wikilinks/wikiLinkUtils";
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
	onOpenWikiLink,
}: BlockConfig) {
	const { focusBlock, blurBlock } = useFocusBlock();
	const { scrollViewRef, scrollYRef, viewHeightRef } = useEditorScrollView();
	const inputRef = useRef<TextInput>(null);
	const ignoreNextChangeRef = useRef(false);
	const prevIsFocusedRef = useRef(false);
	const selectionRange = useEditorBlockSelection(index);
	const getFocusedBlockIndex = useEditorState(
		(state) => state.getFocusedBlockIndex,
	);
	const handleVerticalArrow = useVerticalArrowNavigation(index, selectionRange);

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
		if (isFocused) {
			return;
		}
		focusBlock(index);
	}, [focusBlock, index, isFocused]);

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
	const handleWikiLinkPress = useCallback(
		async (title: string, event: GestureResponderEvent) => {
			const wikiEvent = event as GestureResponderEvent &
				WikiLinkActivationEvent;

			if (!shouldOpenWikiLink(Platform.OS, wikiEvent)) {
				handleFocus();
				return;
			}

			stopWikiLinkActivation(wikiEvent);
			await onOpenWikiLink(title);
		},
		[handleFocus, onOpenWikiLink],
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

			if (handleVerticalArrow(key)) {
				return;
			}

			// Match list-block behavior for normal typing: only intercept space
			// when we explicitly handle a markdown trigger at the block end.
			if (
				key === " " &&
				block.type === BlockType.paragraph &&
				selectionRange &&
				selectionRange.start === selectionRange.end
			) {
				const handled = onSpace(index, selectionRange.end);
				if (handled) {
					return;
				}
			}
			const isShiftModified = Boolean(
				(
					e.nativeEvent as TextInputKeyPressEventData & {
						shiftKey?: boolean;
					}
				).shiftKey,
			);

			// Handle Enter key - split non-code blocks at the current cursor position
			if (
				key === "Enter" &&
				!isShiftModified &&
				selectionRange &&
				selectionRange.start === selectionRange.end
			) {
				if (block.type !== BlockType.codeBlock) {
					if (Platform.OS === "web") {
						// On web, React re-renders and moves focus to the new block before
						// the browser fires its default action (inserting \n). Preventing
						// the default stops the \n from landing in the new block's textarea.
						e.preventDefault();
					} else {
						// On native, focus stays on the current textarea when the default
						// action fires, so we can safely ignore that one onChangeText.
						ignoreNextChangeRef.current = true;
					}
					onEnter(index, selectionRange.end);
				}
				return;
			}

			// Handle backspace at the start (position 0)
			if (
				key === "Backspace" &&
				selectionRange?.start === 0 &&
				selectionRange?.end === 0
			) {
				if (Platform.OS === "web") {
					e.preventDefault();
				} else {
					ignoreNextChangeRef.current = true;
				}

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
		[
			block.type,
			handleVerticalArrow,
			index,
			onBackspaceAtStart,
			onEnter,
			onSpace,
			selectionRange,
		],
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
		isFocused && selectionRange
			? (() => {
					const len = block.content.length;
					return {
						start: Math.min(selectionRange.start, len),
						end: Math.min(selectionRange.end, len),
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
					pointerEvents="box-none"
				>
					<InlineMarkdown
						text={block.content}
						style={textStyle}
						onWikiLinkPress={handleWikiLinkPress}
					/>
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
			...Platform.select({
				web: { outlineWidth: 0 },
			}),
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
