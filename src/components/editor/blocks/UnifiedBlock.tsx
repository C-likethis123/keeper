import { useVerticalArrowNavigation } from "@/components/editor/keyboard/useVerticalArrowNavigation";
import TextInput from "@/components/shared/TextInput";
import { webMultilineTextInputReset } from "@/components/shared/textInputWebStyles";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useStyles } from "@/hooks/useStyles";
import { useEditorBlockSelection, useEditorState } from "@/stores/editorStore";
import React, {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react";
import type { GestureResponderEvent } from "react-native";
import {
	type NativeMethods,
	type NativeSyntheticEvent,
	type TextInput as NativeTextInput,
	Platform,
	Pressable,
	StyleSheet,
	type TextInputKeyPressEventData,
	type TextInputSelectionChangeEventData,
	type TextStyle,
	View,
} from "react-native";
import { useEditorScrollView } from "../EditorScrollContext";
import { BlockType, getListLevel, isListItem } from "../core/BlockNode";
import { InlineMarkdown } from "../rendering/InlineMarkdown";
import { useSlashCommandContext } from "../slash-commands/SlashCommandContext";
import { findSlashCommandTriggerStart } from "../slash-commands/SlashCommandTrigger";
import { useWikiLinkContext } from "../wikilinks/WikiLinkContext";
import { findWikiLinkTriggerStart } from "../wikilinks/WikiLinkTrigger";
import {
	type WikiLinkActivationEvent,
	shouldOpenWikiLink,
	stopWikiLinkActivation,
} from "../wikilinks/wikiLinkUtils";
import type { BlockConfig } from "./BlockRegistry";
import { ListMarker } from "./ListMarker";

// In jest, requestAnimationFrame falls back to setTimeout and never flushes
// during a synchronous test step, so dispatches would be lost. Tests still
// assert intermediate state synchronously after fireEvent.changeText, so we
// flush eagerly there. Production keeps the rAF batching.
const SYNC_DISPATCH =
	typeof (globalThis as { jest?: unknown }).jest !== "undefined";

// react-native-web does not expose setNativeProps on the TextInput ref; the
// ref doubles as the DOM textarea, so go through the standard DOM APIs there.
function setInputText(input: NativeTextInput | null, text: string) {
	if (!input) return;
	if (Platform.OS === "web") {
		const el = input as unknown as HTMLTextAreaElement;
		if ("value" in el) el.value = text;
		return;
	}
	input.setNativeProps?.({ text });
}

function setInputSelection(
	input: NativeTextInput | null,
	selection: { start: number; end: number },
) {
	if (!input) return;
	if (Platform.OS === "web") {
		const el = input as unknown as HTMLTextAreaElement;
		if (typeof el.setSelectionRange === "function") {
			el.setSelectionRange(selection.start, selection.end);
		}
		return;
	}
	input.setNativeProps?.({ selection });
}

export function UnifiedBlock({
	block,
	index,
	isFocused,
	hasBlockSelection,
	onContentChange,
	onBackspaceAtStart,
	onSpace,
	onEnter,
	onBlockExit,
	onSelectionChange,
	listItemNumber,
	onCheckboxToggle,
	onOpenWikiLink,
	clearStructuredSelection,
}: BlockConfig) {
	const { focusBlock, focusBlockAt, blurBlock } = useFocusBlock();
	const { scrollViewRef, scrollYRef, viewHeightRef } = useEditorScrollView();
	const inputRef = useRef<NativeTextInput>(null);
	const ignoreNextChangeRef = useRef(false);
	const prevIsFocusedRef = useRef(false);
	const selectionRange = useEditorBlockSelection(index);
	const isWeb = Platform.OS === "web";
	const getFocusedBlockIndex = useEditorState(
		(state) => state.getFocusedBlockIndex,
	);
	const handleVerticalArrow = useVerticalArrowNavigation(index, selectionRange);

	// Local mirror of what the native TextInput actually holds. The input is
	// uncontrolled — we never pass `value` or `selection` as props during typing,
	// because doing so forces RN to push text + cursor back into the native widget
	// on every keystroke, which is the dominant source of input lag at scale.
	const localContentRef = useRef(block.content);
	const localSelectionRef = useRef<{ start: number; end: number }>({
		start: block.content.length,
		end: block.content.length,
	});
	const pendingFlushRef = useRef(false);
	const rafIdRef = useRef<number | null>(null);

	const flushPendingDispatch = useCallback(() => {
		if (rafIdRef.current !== null) {
			cancelAnimationFrame(rafIdRef.current);
			rafIdRef.current = null;
		}
		if (!pendingFlushRef.current) return;
		pendingFlushRef.current = false;
		const text = localContentRef.current;
		const sel = localSelectionRef.current;
		const storeBlock = useEditorState.getState().document.blocks[index];
		if (storeBlock && storeBlock.content !== text) {
			onContentChange(index, text, sel.end);
		} else {
			onSelectionChange(index, sel.start, sel.end);
		}
	}, [index, onContentChange, onSelectionChange]);

	const scheduleDispatch = useCallback(() => {
		pendingFlushRef.current = true;
		if (SYNC_DISPATCH) {
			flushPendingDispatch();
			return;
		}
		if (rafIdRef.current !== null) return;
		rafIdRef.current = requestAnimationFrame(() => {
			rafIdRef.current = null;
			flushPendingDispatch();
		});
	}, [flushPendingDispatch]);

	useEffect(() => {
		return () => {
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current);
			}
		};
	}, []);

	// Sync FROM store TO native input when content changes externally
	// (undo/redo, structural commands, paste from another path). Skip when the
	// store update is just catching up to what the user already typed locally.
	useLayoutEffect(() => {
		if (block.content === localContentRef.current) return;
		localContentRef.current = block.content;
		setInputText(inputRef.current, block.content);
	}, [block.content]);

	// Sync FROM store TO native cursor only when the store moves the selection
	// programmatically (focus moves, splitBlock, etc.). During normal typing the
	// native cursor is already correct, so this no-ops because the store
	// selection is updated to match what we emitted.
	useLayoutEffect(() => {
		if (!isFocused || !selectionRange) return;
		const local = localSelectionRef.current;
		if (
			local.start === selectionRange.start &&
			local.end === selectionRange.end
		) {
			return;
		}
		const len = block.content.length;
		const next = {
			start: Math.min(selectionRange.start, len),
			end: Math.min(selectionRange.end, len),
		};
		localSelectionRef.current = next;
		setInputSelection(inputRef.current, next);
	}, [isFocused, selectionRange, block.content.length]);

	useLayoutEffect(() => {
		if (isFocused && !prevIsFocusedRef.current && inputRef.current) {
			// Only programmatically focus if the TextInput isn't already focused.
			// When the user clicks directly on the (opacity:0) TextInput, it gets
			// native focus with the cursor at the clicked character. Calling focus()
			// again here resets the cursor to the end in most browsers, overriding
			// the click position. Skip it; the native cursor position is correct.
			if (!inputRef.current.isFocused()) {
				inputRef.current.focus();
			}
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

	// Tracks whether the TextInput received native focus from a user click so
	// handlePressablePress can skip its own focusBlock call (which would set the
	// cursor to content.length, overriding the clicked position).
	const textInputNativelyFocusedRef = useRef(false);

	const handleTextInputFocus = useCallback(() => {
		if (isFocused && !hasBlockSelection) return;
		clearStructuredSelection();
		if (Platform.OS === "web") {
			const el = document.activeElement as HTMLTextAreaElement | null;
			const offset = el?.selectionStart ?? block.content.length;
			textInputNativelyFocusedRef.current = true;
			localSelectionRef.current = { start: offset, end: offset };
			focusBlockAt(index, offset);
		} else {
			focusBlock(index);
		}
	}, [
		block.content.length,
		clearStructuredSelection,
		focusBlock,
		focusBlockAt,
		hasBlockSelection,
		index,
		isFocused,
	]);

	const handleFocus = useCallback(() => {
		if (isFocused && !hasBlockSelection) return;
		if (textInputNativelyFocusedRef.current) {
			textInputNativelyFocusedRef.current = false;
			return;
		}
		clearStructuredSelection();
		focusBlock(index);
	}, [
		clearStructuredSelection,
		focusBlock,
		hasBlockSelection,
		index,
		isFocused,
	]);

	// Web: document selectionchange fires on every cursor placement (including
	// plain clicks), whereas the TextInput onSelectionChange prop uses the
	// textarea `select` event which only fires on text selection. Coalesce via
	// rAF so we don't dispatch on every keystroke.
	useEffect(() => {
		if (!isWeb || !isFocused) return;
		const handleDocSelectionChange = () => {
			const el = document.activeElement as HTMLTextAreaElement | null;
			if (el?.selectionStart == null) return;
			const start = el.selectionStart;
			const end = el.selectionEnd ?? start;
			if (
				localSelectionRef.current.start === start &&
				localSelectionRef.current.end === end
			) {
				return;
			}
			localSelectionRef.current = { start, end };
			scheduleDispatch();
		};
		document.addEventListener("selectionchange", handleDocSelectionChange);
		return () =>
			document.removeEventListener("selectionchange", handleDocSelectionChange);
	}, [isWeb, isFocused, scheduleDispatch]);

	const handleBlur = useCallback(() => {
		flushPendingDispatch();
		onBlockExit?.(index);
		const currentFocus = getFocusedBlockIndex();
		if (currentFocus === index) {
			blurBlock();
		}
	}, [
		blurBlock,
		flushPendingDispatch,
		getFocusedBlockIndex,
		index,
		onBlockExit,
	]);

	const handleSelectionChange = useCallback(
		(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
			const { start, end } = e.nativeEvent.selection;
			if (
				localSelectionRef.current.start === start &&
				localSelectionRef.current.end === end
			) {
				return;
			}
			localSelectionRef.current = { start, end };
			scheduleDispatch();
		},
		[scheduleDispatch],
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
	const { showActions } = useWikiLinkContext();
	const handleWikiLinkLongPress = useCallback(
		(title: string, event: GestureResponderEvent) => {
			if (Platform.OS !== "web") {
				showActions(title, event);
			}
		},
		[showActions],
	);
	const wikiLinks = useWikiLinkContext();
	const slashCommands = useSlashCommandContext();
	const handleContentChange = useCallback(
		(newText: string) => {
			// When we handle Enter to split the block, React Native's TextInput will still
			// emit an onChangeText with a newline. We want to ignore that one change,
			// because the actual split is handled via EditorState.splitBlock.
			if (ignoreNextChangeRef.current) {
				ignoreNextChangeRef.current = false;
				return;
			}

			localContentRef.current = newText;
			// onSelectionChange may not have arrived yet (Android fires it after
			// onChangeText); use end-of-text as the caret hint for trigger detection
			// and as a fallback for the local selection ref.
			const caret = newText.length;
			if (
				localSelectionRef.current.end > newText.length ||
				localSelectionRef.current.start > newText.length
			) {
				localSelectionRef.current = { start: caret, end: caret };
			}
			scheduleDispatch();

			if (isFocused) {
				const wikiLinkStart = findWikiLinkTriggerStart(newText, caret);
				const slashCommandStart = findSlashCommandTriggerStart(newText, caret);
				if (wikiLinkStart !== null) {
					const query = newText.slice(wikiLinkStart + 2, caret);
					slashCommands.handleCancel();
					wikiLinks.handleTriggerStart(index, wikiLinkStart, query);
				} else if (slashCommandStart !== null) {
					const query = newText.slice(slashCommandStart + 1, caret);
					wikiLinks.handleCancel();
					slashCommands.handleTriggerStart(index, slashCommandStart, query);
				} else {
					wikiLinks.handleCancel();
					slashCommands.handleCancel();
				}
			}
		},
		[
			index,
			isFocused,
			scheduleDispatch,
			wikiLinks.handleTriggerStart,
			wikiLinks.handleCancel,
			slashCommands.handleTriggerStart,
			slashCommands.handleCancel,
		],
	);

	const handleKeyPress = useCallback(
		(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
			const key = e.nativeEvent.key;

			if (handleVerticalArrow(key)) {
				return;
			}

			const sel = localSelectionRef.current;
			const isCaret = sel.start === sel.end;

			if (key === " " && block.type === BlockType.paragraph && isCaret) {
				flushPendingDispatch();
				const handled = onSpace(index, sel.end);
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
			if (key === "Enter" && !isShiftModified && isCaret) {
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
					flushPendingDispatch();
					onEnter(index, sel.end);
				}
				return;
			}

			// Handle backspace at the start (position 0)
			if (key === "Backspace" && sel.start === 0 && sel.end === 0) {
				if (Platform.OS === "web") {
					e.preventDefault();
				} else {
					ignoreNextChangeRef.current = true;
				}

				flushPendingDispatch();
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
			flushPendingDispatch,
			handleVerticalArrow,
			index,
			onBackspaceAtStart,
			onEnter,
			onSpace,
		],
	);

	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);

	// Compute text style based on block type
	const textStyle: TextStyle = useMemo(() => {
		switch (block.type) {
			case BlockType.heading1:
				return styles.heading1Style;
			case BlockType.heading2:
				return styles.heading2Style;
			case BlockType.heading3:
				return styles.heading3Style;
			default:
				return styles.bodyStyle;
		}
	}, [block.type, styles]);
	const textInputStyle = [
		styles.input,
		textStyle,
		{
			opacity: isFocused ? 1 : 0,
			position: "absolute" as const,
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
		},
	];

	// The InlineMarkdown overlay sits behind the input and is only visible when
	// the block is unfocused. Re-parsing it on every keystroke while invisible
	// is pure waste, so memoize on content + style and skip when focused.
	const inlineMarkdown = useMemo(
		() => (
			<InlineMarkdown
				text={block.content}
				style={textStyle}
				onWikiLinkPress={handleWikiLinkPress}
				onWikiLinkLongPress={handleWikiLinkLongPress}
			/>
		),
		[block.content, textStyle, handleWikiLinkPress, handleWikiLinkLongPress],
	);

	const applyListStyles = isListItem(block.type);

	return (
		<Pressable
			style={({ pressed }) => [styles.container, pressed && styles.pressed]}
			onPress={handleFocus}
		>
			<View style={[styles.row]}>
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
						applyListStyles && { marginLeft: (getListLevel(block) + 1) * 16 },
						isFocused &&
							block.content === "" && { minHeight: textStyle.lineHeight ?? 24 },
					]}
					pointerEvents="box-none"
				>
					<TextInput
						ref={inputRef}
						style={textInputStyle}
						defaultValue={block.content}
						onChangeText={handleContentChange}
						onFocus={handleTextInputFocus}
						onBlur={handleBlur}
						onKeyPress={handleKeyPress}
						onSelectionChange={handleSelectionChange}
						multiline
						scrollEnabled={false}
						autoCapitalize="none"
						autoCorrect={false}
						spellCheck={false}
						autoComplete="off"
						placeholderTextColor={theme.custom.editor.placeholder}
						textAlignVertical="top"
						underlineColorAndroid="transparent"
					/>
					{/* Always rendered to provide layout height for the absolutely-
              positioned TextInput; hidden when focused so the textarea shows. */}
					<View
						style={[styles.overlay, isFocused && { opacity: 0 }]}
						pointerEvents="box-none"
					>
						{inlineMarkdown}
					</View>
				</View>
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
			position: "relative",
		},
		overlay: {
			alignItems: "flex-start",
		},
		input: {
			flex: 1,
			color: theme.colors.text,
			...webMultilineTextInputReset,
		},
		heading1Style: theme.typography.heading1,
		heading2Style: theme.typography.heading2,
		heading3Style: theme.typography.heading3,
		bodyStyle: theme.typography.body,
	});
}
