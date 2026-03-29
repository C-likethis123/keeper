import {
	type VideoMode,
	parseEmbeddedVideoUrl,
} from "@/components/editor/video/videoUtils";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useEditorScrollView } from "../EditorScrollContext";
import { EmbeddedVideoPanel } from "../video/EmbeddedVideoPanel";
import type { BlockConfig } from "./BlockRegistry";
import { useBlockInputHandlers } from "./useBlockInputHandlers";

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
	const inputRef = useRef<TextInput | null>(null);
	const lastLayoutRef = useRef<{ y: number; height: number } | null>(null);
	const styles = useStyles(createStyles);
	const videoSource = parseEmbeddedVideoUrl(block.content);
	const { registerVideoLayout, unregisterVideoLayout } = useEditorScrollView();
	const { handleFocus, handleKeyPress, handleSelectionChange } =
		useBlockInputHandlers({
			index,
			isFocused,
			onEnter,
			onBackspaceAtStart,
			onSelectionChange,
		});
	const [videoMode, setVideoMode] = useState<VideoMode>("normal");

	useEffect(() => {
		if (lastLayoutRef.current) {
			registerVideoLayout(index, lastLayoutRef.current);
		}
		return () => {
			unregisterVideoLayout(index);
		};
	}, [index, registerVideoLayout, unregisterVideoLayout]);

	return (
		<Pressable
			style={({ pressed }) => [
				styles.container,
				isFocused && styles.focused,
				pressed && styles.pressed,
			]}
			onPress={handleFocus}
			onLayout={(event) => {
				const { y, height } = event.nativeEvent.layout;
				const layout = { y, height };
				lastLayoutRef.current = layout;
				registerVideoLayout(index, layout);
			}}
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
