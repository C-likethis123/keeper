import { useVerticalArrowNavigation } from "@/components/editor/keyboard/useVerticalArrowNavigation";
import {
	type VideoMode,
	parseEmbeddedVideoUrl,
} from "@/components/editor/video/videoUtils";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useStyles } from "@/hooks/useStyles";
import { useEditorBlockSelection } from "@/stores/editorStore";
import React, { useCallback, useRef, useState } from "react";
import {
	type NativeSyntheticEvent,
	Pressable,
	StyleSheet,
	TextInput,
	type TextInputKeyPressEventData,
	type TextInputSelectionChangeEventData,
	View,
} from "react-native";
import { EmbeddedVideoPanel } from "../video/EmbeddedVideoPanel";
import type { BlockConfig } from "./BlockRegistry";

// TODO: maybe integrate this with the UnifiedBlock?
export function VideoBlock({
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
	const selection = useEditorBlockSelection(index);
	const styles = useStyles(createStyles);
	const videoSource = parseEmbeddedVideoUrl(block.content);
	const handleVerticalArrow = useVerticalArrowNavigation(index, selection);
	const handleFocus = useCallback(() => {
		if (isFocused) {
			return;
		}
		focusBlock(index);
	}, [focusBlock, index, isFocused]);
	const handleKeyPress = useCallback(
		(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
			const key = e.nativeEvent.key;
			if (handleVerticalArrow(key)) {
				return;
			}
			if (key === "Enter" && selection && selection.start === selection.end) {
				onEnter(index, selection.end);
			}

			if (
				key === "Backspace" &&
				selection?.start === 0 &&
				selection?.end === 0
			) {
				onBackspaceAtStart(index);
				return;
			}
		},
		[handleVerticalArrow, index, onBackspaceAtStart, onEnter, selection],
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
	const [videoMode, setVideoMode] = useState<VideoMode>("normal");
	return (
		<Pressable
			style={({ pressed }) => [
				styles.container,
				isFocused && styles.focused,
				pressed && styles.pressed,
			]}
			onPress={handleFocus}
		>
			{!isFocused && videoSource && (
				<View style={styles.stackedSplitShell}>
					<EmbeddedVideoPanel
						source={videoSource}
						style={
							videoMode === "normal"
								? styles.videoPanel
								: styles.videoPanelMinimised
						}
						mode={videoMode}
						onToggleMode={() =>
							setVideoMode((m) => (m === "normal" ? "minimised" : "normal"))
						}
					/>
				</View>
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
		stackedSplitShell: {
			flex: 1,
			flexDirection: "column",
			gap: 8,
		},
		videoPanel: {},
		videoPanelMinimised: {
			flex: 0,
		},
		videoModalActions: {
			flexDirection: "row",
			justifyContent: "flex-end",
			gap: 8,
			marginTop: 12,
		},
	});
}
