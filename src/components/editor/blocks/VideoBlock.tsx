import { useEditorScrollView } from "@/components/editor/EditorScrollContext";
import { useVerticalArrowNavigation } from "@/components/editor/keyboard/useVerticalArrowNavigation";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorBlockSelection, useEditorState } from "@/stores/editorStore";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type NativeSyntheticEvent,
	Platform,
	Pressable,
	type StyleProp,
	StyleSheet,
	Text,
	TextInput,
	type TextInputKeyPressEventData,
	type TextInputSelectionChangeEventData,
	View,
	type ViewStyle,
} from "react-native";
import { WebView } from "react-native-webview";
import type { BlockConfig } from "./BlockRegistry";
import { getYouTubeEmbedUrl } from "./videoUtils";

export function EmbeddedVideoPreview({
	url,
	testID,
	style,
}: {
	url: string;
	testID?: string;
	style?: StyleProp<ViewStyle>;
}) {
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const embedUrl = getYouTubeEmbedUrl(url);

	if (!embedUrl) {
		return (
			<View style={[styles.preview, style]} testID={testID}>
				<View style={styles.placeholder}>
					<Text style={styles.placeholderTitle}>Paste a YouTube URL</Text>
					{url ? <Text style={styles.placeholderUrl}>{url}</Text> : null}
				</View>
			</View>
		);
	}

	if (Platform.OS === "web") {
		return (
			<View style={[styles.preview, style]} testID={testID}>
				{React.createElement("iframe", {
					allow:
						"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
					allowFullScreen: true,
					src: embedUrl,
					style: {
						border: 0,
						width: "100%",
						height: "100%",
					},
					title: "Embedded YouTube video",
				})}
			</View>
		);
	}

	return (
		<View style={[styles.preview, style]} testID={testID}>
			<WebView
				allowsFullscreenVideo
				javaScriptEnabled
				scrollEnabled={false}
				source={{ uri: embedUrl }}
				style={styles.webview}
			/>
		</View>
	);
}

export function VideoBlock({
	block,
	index,
	isFocused,
	onContentChange,
	onBackspaceAtStart,
	onEnter,
	onSelectionChange,
}: BlockConfig) {
	const { focusBlock, blurBlock } = useFocusBlock();
	const selection = useEditorBlockSelection(index);
	const getFocusedBlockIndex = useEditorState(
		(state) => state.getFocusedBlockIndex,
	);
	const inputRef = useRef<TextInput | null>(null);
	const [value, setValue] = useState(block.content);
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const handleVerticalArrow = useVerticalArrowNavigation(index, selection);
	const { viewportHeight } = useEditorScrollView();
	const previewMaxHeight = viewportHeight
		? Math.max(0, viewportHeight / 2)
		: undefined;
	const previewMinHeight = viewportHeight
		? Math.max(0, viewportHeight * 0.4)
		: 220;

	useEffect(() => {
		if (block.content !== value) {
			setValue(block.content);
		}
	}, [block.content, value]);

	useEffect(() => {
		onContentChange(index, value);
	}, [index, onContentChange, value]);

	useEffect(() => {
		if (isFocused) {
			inputRef.current?.focus();
		}
	}, [isFocused]);

	const handleFocus = useCallback(() => {
		if (!isFocused) {
			focusBlock(index);
		}
	}, [focusBlock, index, isFocused]);

	const handleBlur = useCallback(() => {
		if (getFocusedBlockIndex() === index) {
			blurBlock();
		}
	}, [blurBlock, getFocusedBlockIndex, index]);

	const handleSelectionChange = useCallback(
		(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
			onSelectionChange(
				index,
				e.nativeEvent.selection.start,
				e.nativeEvent.selection.end,
			);
		},
		[index, onSelectionChange],
	);

	const handleKeyPress = useCallback(
		(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
			const key = e.nativeEvent.key;

			if (handleVerticalArrow(key)) {
				return;
			}

			if (key === "Enter" && selection && selection.start === selection.end) {
				onEnter(index, selection.end);
				return;
			}

			if (
				key === "Backspace" &&
				selection?.start === 0 &&
				selection?.end === 0
			) {
				onBackspaceAtStart(index);
			}
		},
		[handleVerticalArrow, index, onBackspaceAtStart, onEnter, selection],
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
			{!isFocused && (
				<EmbeddedVideoPreview
					url={value}
					style={[
						styles.inlinePreview,
						{ minHeight: previewMinHeight },
						previewMaxHeight ? { maxHeight: previewMaxHeight } : null,
					]}
				/>
			)}
			<TextInput
				ref={inputRef}
				style={[
					styles.input,
					isFocused ? styles.inputVisible : styles.inputHidden,
				]}
				value={value}
				onBlur={handleBlur}
				onChangeText={setValue}
				onFocus={handleFocus}
				onKeyPress={handleKeyPress}
				onSelectionChange={handleSelectionChange}
				autoCapitalize="none"
				autoCorrect={false}
				placeholder="Paste a YouTube URL"
				placeholderTextColor={theme.custom.editor.placeholder}
			/>
		</Pressable>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			paddingHorizontal: 16,
			paddingVertical: 8,
			backgroundColor: theme.colors.background,
		},
		focused: {
			backgroundColor: theme.custom.editor.blockFocused,
		},
		pressed: {
			opacity: 0.95,
		},
		preview: {
			borderRadius: 12,
			overflow: "hidden",
			backgroundColor: theme.colors.card,
			borderWidth: 1,
			borderColor: theme.colors.border,
			aspectRatio: 16 / 9,
			minHeight: 220,
			justifyContent: "center",
			maxWidth: "100%",
		},
		inlinePreview: {
			alignSelf: "center",
		},
		placeholder: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
			padding: 20,
			gap: 8,
		},
		placeholderTitle: {
			color: theme.colors.text,
			fontSize: 16,
			fontWeight: "600",
		},
		placeholderUrl: {
			color: theme.colors.textMuted,
			fontSize: 13,
			textAlign: "center",
		},
		input: {
			minHeight: 24,
			color: theme.colors.text,
		},
		inputVisible: {
			marginTop: 8,
			opacity: 1,
		},
		inputHidden: {
			position: "absolute",
			left: -9999,
			width: 1,
			height: 1,
			opacity: 0,
		},
		webview: {
			flex: 1,
			backgroundColor: "#000000",
		},
	});
}
