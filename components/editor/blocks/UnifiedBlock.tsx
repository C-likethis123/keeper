import { useEditorState } from "@/contexts/EditorContext";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
	type NativeSyntheticEvent,
	Pressable,
	StyleSheet,
	TextInput,
	type TextInputKeyPressEventData,
	type TextInputSelectionChangeEventData,
	type TextStyle,
	View,
} from "react-native";
import { BlockType, getListLevel, isListItem } from "../core/BlockNode";
import { InlineMarkdown } from "../rendering/InlineMarkdown";
import { WikiLinkTrigger } from "../wikilinks/WikiLinkTrigger";
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
	onWikiLinkTriggerStart,
	onWikiLinkQueryUpdate,
	onWikiLinkTriggerEnd,
}: BlockConfig) {
	const { focusBlock, blurBlock } = useFocusBlock();
	const inputRef = useRef<TextInput>(null);
	const ignoreNextChangeRef = useRef(false);
	const lastBlockContentRef = useRef(block.content);
	const editorState = useEditorState();

	// Sync TextInput when block content changes externally (e.g., from wiki link selection)
	useEffect(() => {
		if (block.content !== lastBlockContentRef.current && inputRef.current) {
			// Block content changed externally - update TextInput
			lastBlockContentRef.current = block.content;
			// Force update by setting native props
			if (inputRef.current) {
				inputRef.current.setNativeProps({ text: block.content });
				// Also update selection to end of new content
				inputRef.current.setNativeProps({
					selection: { start: block.content.length, end: block.content.length },
				});
			}
		}
	}, [block.content]);
	useEffect(() => {
		if (isFocused && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isFocused]);

	// Re-apply selection after native value update so cursor at end doesn't jump (native often resets selection when value prop changes)
	const prevContentRef = useRef(block.content);
	useEffect(() => {
		if (
			!isFocused ||
			!inputRef.current ||
			!editorState.selection ||
			editorState.selection.focus.blockIndex !== index
		)
			return;
		if (block.content === prevContentRef.current) return;
		prevContentRef.current = block.content;
		const start = Math.min(
			editorState.selection.anchor.offset,
			editorState.selection.focus.offset,
		);
		const end = Math.max(
			editorState.selection.anchor.offset,
			editorState.selection.focus.offset,
		);
		const len = block.content.length;
		const sel = {
			start: Math.min(start, len),
			end: Math.min(end, len),
		};
		const id = requestAnimationFrame(() => {
			inputRef.current?.setNativeProps({ selection: sel });
		});
		return () => cancelAnimationFrame(id);
	}, [block.content, index, isFocused, editorState.selection]);

	const handleFocus = useCallback(() => {
		focusBlock(index);
	}, [focusBlock, index]);

	const handleBlur = useCallback(() => {
		blurBlock();
		// End wiki link session on blur, but with a delay to allow overlay selection
		// The delay gives the overlay's onPress time to fire before ending the session
		setTimeout(() => {
			onWikiLinkTriggerEnd?.();
		}, 150);
	}, [blurBlock, onWikiLinkTriggerEnd]);

	const handleSelectionChange = useCallback(
		(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
			const newSelection = {
				start: e.nativeEvent.selection.start,
				end: e.nativeEvent.selection.end,
			};
			// setSelection(newSelection);
			onSelectionChange(newSelection.start, newSelection.end);

			if (isFocused && newSelection.start === newSelection.end) {
				const caret = newSelection.start;
				if (caret > block.content.length) {
					return;
				}
				const triggerStart = WikiLinkTrigger.findStart(block.content, caret);
				if (triggerStart !== null) {
					onWikiLinkTriggerStart();
					const query = block.content.substring(triggerStart + 2, caret);
					onWikiLinkQueryUpdate?.(query, caret);
				} else {
					onWikiLinkTriggerEnd?.();
				}
			}
		},
		[
			isFocused,
			block.content,
			onSelectionChange,
			onWikiLinkTriggerStart,
			onWikiLinkQueryUpdate,
			onWikiLinkTriggerEnd,
		],
	);

	const handleContentChange = useCallback(
		(newText: string) => {
			lastBlockContentRef.current = newText;
			// When we handle Enter to split the block, React Native's TextInput will still
			// emit an onChangeText with a newline. We want to ignore that one change,
			// because the actual split is handled via EditorState.splitBlock.
			if (ignoreNextChangeRef.current) {
				ignoreNextChangeRef.current = false;
				return;
			}

			onContentChange(newText);

			// Detect wiki link triggers after content change. Use newText.length as caret
			// because editorState.selection is not updated yet when onChangeText fires.
			if (isFocused && inputRef.current) {
				const caret = newText.length;
				const start = WikiLinkTrigger.findStart(newText, caret);
				if (start !== null) {
					onWikiLinkTriggerStart();
					const query = newText.substring(start + 2, caret);
					onWikiLinkQueryUpdate?.(query, caret);
				} else {
					onWikiLinkTriggerEnd?.();
				}
			}
		},
		[
			onContentChange,
			isFocused,
			onWikiLinkTriggerStart,
			onWikiLinkQueryUpdate,
			onWikiLinkTriggerEnd,
		],
	);

	const handleKeyPress = useCallback(
		(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
			const key = e.nativeEvent.key;

			// Handle space key - trigger block type detection for paragraph blocks
			if (key === " " && block.type === BlockType.paragraph) {
				onSpace?.();
				return;
			}

			// Cmd+Enter / Ctrl+Enter: toggle checkbox (when supported by platform)
			if (key === "Enter" && block.type === BlockType.checkboxList) {
				const mod =
					"metaKey" in e.nativeEvent &&
					(e.nativeEvent as { metaKey?: boolean }).metaKey;
				if (mod) {
					onCheckboxToggle(index);
					return;
				}
			}

			// Handle Enter key - split non-code blocks at the current cursor position
			if (
				key === "Enter" &&
				editorState.selection?.anchor.offset ===
				editorState.selection?.focus.offset
			) {
				if (block.type !== BlockType.codeBlock) {
					// Mark the next onChangeText as ignorable so the stray newline doesn't
					// get written back into the original block after we split.
					ignoreNextChangeRef.current = true;
					onEnter?.(editorState.selection?.focus.offset ?? 0);
				}
				return;
			}

			// Handle backspace at the start (position 0)
			if (
				key === "Backspace" &&
				editorState.selection?.anchor.offset === 0 &&
				editorState.selection?.focus.offset === 0
			) {
				// Paragraph blocks: delegate to editor-level handler (empty = delete, non-empty = merge or focus previous)
				if (block.type === BlockType.paragraph) {
					onBackspaceAtStart?.();
					return;
				}

				// Non-paragraph, non-code blocks (e.g., headings): convert to paragraph
				if (block.type !== BlockType.codeBlock) {
					onBackspaceAtStart?.();
				}
				return;
			}
		},
		[
			onSpace,
			onEnter,
			onBackspaceAtStart,
			onCheckboxToggle,
			index,
			editorState.selection,
			block.type,
			block.content,
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
		isFocused &&
			editorState.selection &&
			editorState.selection.focus.blockIndex === index
			? (() => {
				const start = Math.min(
					editorState.selection!.anchor.offset,
					editorState.selection!.focus.offset,
				);
				const end = Math.max(
					editorState.selection!.anchor.offset,
					editorState.selection!.focus.offset,
				);
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
		autofocus: true,
		placeholder: "Start typing...",
		placeholderTextColor: theme.custom.editor.placeholder,
	};

	const applyListStyles = isListItem(block.type);
	// Single branch so the same TextInput stays mounted when block type changes
	// (paragraph → list). Otherwise the paragraph input unmounts and keyboard dismisses.
	const listMarker = applyListStyles ? (
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
	) : null;
	const overlay = !isFocused ? (
		applyListStyles ? (
			<View style={styles.overlayContent} pointerEvents="none">
				<InlineMarkdown text={block.content} style={textStyle} />
			</View>
		) : (
			<View
				style={styles.overlay}
				pointerEvents="none"
			>
				<InlineMarkdown text={block.content} style={textStyle} />
			</View>
		)
	) : null;

	return (
		<Pressable
			style={({ pressed }) => [
				styles.container,
				pressed && styles.pressed,
			]}
			onPress={handleFocus}
		>
			<View style={styles.row}>
				{listMarker}
				{overlay}
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
			minHeight: 40,
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
			position: "absolute",
			left: 0,
			right: 0,
			top: 0,
			pointerEvents: "none",
			zIndex: 1,
		},
		overlayContent: {
			alignItems: "flex-start",
		},
		input: {
			flex: 1,
			minHeight: 24,
			padding: 0,
			paddingHorizontal: 2,
			paddingVertical: 2,
			color: theme.colors.text,
		},
		inputVisible: {
			opacity: 1,
		},
		inputHidden: {
			opacity: 0,
		},
	});
}
