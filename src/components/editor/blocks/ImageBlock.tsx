import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useStyles } from "@/hooks/useStyles";
import { NOTES_ROOT } from "@/services/notes/Notes";
import { useEditorSelection } from "@/stores/editorStore";
import { Paths } from "expo-file-system";
import { Image } from "expo-image";
import React, { useCallback, useRef } from "react";
import {
	type NativeSyntheticEvent,
	Pressable,
	StyleSheet,
	TextInput,
	type TextInputKeyPressEventData,
	type TextInputSelectionChangeEventData,
} from "react-native";
import type { BlockConfig } from "./BlockRegistry";

function resolveImageUri(path: string): string {
	if (
		path.startsWith("file://") ||
		path.startsWith("http://") ||
		path.startsWith("https://")
	) {
		return path;
	}
	return Paths.join(NOTES_ROOT, path);
}

// TODO: maybe integrate this with the UnifiedBlock?
export function ImageBlock({
	block,
	index,
	isFocused,
	onEnter,
	onContentChange,
	onBackspaceAtStart,
	onSelectionChange,
}: BlockConfig) {
	const { focusBlock } = useFocusBlock();
	const inputRef = useRef<TextInput | null>(null);
	const selection = useEditorSelection();
	const styles = useStyles(createStyles);
	const uri = resolveImageUri(block.content);
	const handleKeyPress = useCallback(
		(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
			const key = e.nativeEvent.key;
			if (
				key === "Enter" &&
				selection?.anchor.offset === selection?.focus.offset
			) {
				onEnter(index, selection?.focus.offset ?? 0);
			}

			if (
				key === "Backspace" &&
				selection?.anchor.offset === 0 &&
				selection?.focus.offset === 0
			) {
				onBackspaceAtStart(index);
				return;
			}
		},
		[onBackspaceAtStart, onEnter, index, selection],
	);

	const handleSelectionChange = useCallback(
		(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
			onSelectionChange(
				index,
				e.nativeEvent.selection.start,
				e.nativeEvent.selection.end,
			);
		},
		[onSelectionChange, index],
	);
	return (
		<Pressable
			style={({ pressed }) => [
				styles.container,
				isFocused && styles.focused,
				pressed && styles.pressed,
			]}
			onPress={() => focusBlock(index)}
		>
			{!isFocused && (
				<Image source={{ uri }} style={styles.image} contentFit="contain" />
			)}
			<TextInput
				ref={inputRef}
				style={[
					styles.input,
					isFocused ? styles.inputVisible : styles.inputHidden,
				]}
				value={block.content}
				onChangeText={(text) => onContentChange(index, text)}
				onKeyPress={handleKeyPress}
				onSelectionChange={handleSelectionChange}
			/>
		</Pressable>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			minHeight: 40,
			paddingHorizontal: 16,
			paddingVertical: 8,
		},
		input: {
			minHeight: 24,
			color: theme.colors.text,
		},
		inputVisible: {
			opacity: 1,
		},
		inputHidden: {
			opacity: 0,
		},
		focused: {
			backgroundColor: theme.custom.editor.blockFocused,
		},
		pressed: {
			opacity: 0.8,
		},
		image: {
			width: "100%",
			maxWidth: 400,
			minHeight: 100,
			borderRadius: 4,
		},
	});
}
