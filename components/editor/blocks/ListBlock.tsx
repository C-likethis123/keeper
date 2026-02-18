import { useEditorState } from "@/contexts/EditorContext";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef
} from "react";
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
import { BlockType } from "../core/BlockNode";
import { InlineMarkdown } from "../rendering/InlineMarkdown";
import { WikiLinkTrigger } from "../wikilinks/WikiLinkTrigger";
import type { BlockConfig } from "./BlockRegistry";
import { ListMarker } from "./ListMarker";

export function ListBlock({
	block,
	index,
	isFocused,
	onContentChange,
	onBackspaceAtStart,
	onSpace,
	onEnter,
	onSelectionChange,
	listItemNumber,
	onWikiLinkTriggerStart,
	onWikiLinkQueryUpdate,
	onWikiLinkTriggerEnd,
}: BlockConfig) {
	const inputRef = useRef<TextInput>(null);
	const { focusBlock, blurBlock } = useFocusBlock();
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

	const handleFocus = useCallback(() => {
		focusBlock(index);
	}, [focusBlock, index]);

	const handleBlur = useCallback(() => {
		blurBlock();
		// End wiki link session on blur, but with a delay to allow overlay selection
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
			onSelectionChange?.(newSelection.start, newSelection.end);

			if (isFocused && newSelection.start === newSelection.end) {
				const caret = newSelection.start;
				const triggerStart = WikiLinkTrigger.findStart(block.content, caret);

				if (triggerStart !== null) {
					onWikiLinkTriggerStart?.(triggerStart);
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
			// Update ref to track current content
			lastBlockContentRef.current = newText;
			if (ignoreNextChangeRef.current) {
				ignoreNextChangeRef.current = false;
				return;
			}
			onContentChange(newText);

			// Detect wiki link triggers after content change
			// requestAnimationFrame(() => {
			// 	if (isFocused && inputRef.current) {
			// 		const caret = selection.start;
			// 		const start = WikiLinkTrigger.findStart(newText, caret);

			// 		if (start !== null) {
			// 			onWikiLinkTriggerStart?.(start);
			// 			const query = newText.substring(start + 2, caret);
			// 			onWikiLinkQueryUpdate?.(query, caret);
			// 		} else {
			// 			onWikiLinkTriggerEnd?.();
			// 		}
			// 	}
			// });
		},
		[
			onContentChange,
			isFocused,
		],
	);

	const handleKeyPress = useCallback(
		(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
			const key = e.nativeEvent.key;

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

			if (key === "Backspace" && editorState.selection?.anchor.offset === 0 && editorState.selection?.focus.offset === 0) {
				if (
					block.type === BlockType.bulletList ||
					block.type === BlockType.numberedList
				) {
					onBackspaceAtStart?.();
				}
				return;
			}
		},
		[onEnter, onBackspaceAtStart, block.type, editorState.selection],
	);

	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const textStyle: TextStyle = useMemo(
		() => theme.typography.body,
		[theme.typography],
	);

	return (
		<Pressable
			style={({ pressed }) => [
				styles.container,
				isFocused && styles.focused,
				pressed && styles.pressed,
			]}
			onPress={handleFocus}
		>
			<View style={styles.row}>
				<ListMarker
					type={block.type as BlockType.bulletList | BlockType.numberedList}
					listLevel={block.listLevel}
					listItemNumber={listItemNumber}
				/>
				{!isFocused && (
					<View style={styles.overlayContent} pointerEvents="none">
						<InlineMarkdown text={block.content} style={textStyle} />
					</View>
				)}
					<TextInput
						ref={inputRef}
						style={[
							styles.input,
							textStyle,
							isFocused ? styles.inputVisible : styles.inputHidden,
						]}
						value={block.content}
						onChangeText={handleContentChange}
						onFocus={handleFocus}
						onBlur={handleBlur}
						onKeyPress={handleKeyPress}
						onSelectionChange={handleSelectionChange}
						multiline
						placeholder={"Start typing..."}
						placeholderTextColor={theme.custom.editor.placeholder}
					/>
				</View>
		</Pressable>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			paddingHorizontal: 16,
			position: "relative",
		},
		row: {
			flexDirection: "row",
			alignItems: "flex-start",
		},
		focused: {
			// backgroundColor: theme.custom.editor.blockFocused,
		},
		pressed: {
			opacity: 0.8,
		},
		overlay: {
			position: "absolute",
			zIndex: 1,
		},
		inputBehindOverlay: {
			zIndex: 0,
		},
		overlayContent: {
			alignItems: "flex-start",
		},
		input: {
			paddingVertical: 0,
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
