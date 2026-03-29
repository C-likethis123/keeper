import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { NOTES_ROOT } from "@/services/notes/Notes";
import { Paths } from "expo-file-system";
import { Image } from "expo-image";
import React, { useRef } from "react";
import { Pressable, StyleSheet, TextInput } from "react-native";
import type { BlockConfig } from "./BlockRegistry";
import { useBlockInputHandlers } from "./useBlockInputHandlers";

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
	const inputRef = useRef<TextInput | null>(null);
	const styles = useStyles(createStyles);
	const uri = resolveImageUri(block.content);
	const { handleFocus, handleKeyPress, handleSelectionChange } =
		useBlockInputHandlers({
			index,
			isFocused,
			onEnter,
			onBackspaceAtStart,
			onSelectionChange,
		});
	return (
		<Pressable
			style={({ pressed }) => [
				styles.container,
				isFocused && styles.focused,
				pressed && styles.pressed,
			]}
			onPress={handleFocus}
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
