import { useVerticalArrowNavigation } from "@/components/editor/keyboard/useVerticalArrowNavigation";
import { webMultilineTextInputReset } from "@/components/shared/textInputWebStyles";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type NativeSyntheticEvent,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	type TextInputKeyPressEventData,
	type TextInputSelectionChangeEventData,
	View,
} from "react-native";
import type { BlockConfig } from "./BlockRegistry";
import { MathView } from "./MathView";

const fontSize = 16;
const padding = 16;
const fontFamily = Platform.OS === "ios" ? "Menlo-Regular" : "monospace";

export function MathBlock({
	block,
	index,
	onContentChange,
	onBackspaceAtStart,
	onSelectionChange,
	isFocused,
}: BlockConfig) {
	const inputRef = useRef<TextInput>(null);
	const [value, setValue] = useState(block.content);
	const [selection, setSelection] = useState<{ start: number; end: number }>({
		start: 0,
		end: 0,
	});
	const [renderError, setRenderError] = useState<string | null>(null);
	const { focusBlock, blurBlock } = useFocusBlock();
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);
	const handleVerticalArrow = useVerticalArrowNavigation(index, selection);

	// Sync value with block content when it changes externally
	useEffect(() => {
		setValue((currentValue) =>
			currentValue === block.content ? currentValue : block.content,
		);
		setRenderError(null);
	}, [block.content]);

	const handleChangeText = useCallback(
		(newValue: string) => {
			setRenderError(null);
			setValue(newValue);
			onContentChange(index, newValue);
		},
		[index, onContentChange],
	);

	const handleSelectionChange = (
		e: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
	) => {
		const sel = e.nativeEvent.selection;
		setSelection(sel);
		onSelectionChange(index, sel.start, sel.end);
	};

	const handleKeyPress = (
		e: NativeSyntheticEvent<TextInputKeyPressEventData>,
	) => {
		const key = e.nativeEvent.key;

		if (handleVerticalArrow(key)) {
			return;
		}

		if (key === "Enter" || key === "Return") {
			return;
		}

		if (
			key === "Backspace" &&
			selection.start === 0 &&
			selection.end === 0 &&
			value === ""
		) {
			onBackspaceAtStart(index);
			return;
		}
	};

	const renderMath = () => {
		if (!value.trim()) {
			return (
				<View style={styles.emptyMath}>
					<Text style={styles.emptyText}>LaTeX equation...</Text>
				</View>
			);
		}

		if (renderError) {
			return (
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{renderError}</Text>
				</View>
			);
		}

		return (
			<View style={styles.mathContainer}>
				<MathView
					expression={value}
					displayMode
					onError={(error) => {
						setRenderError(error || "Invalid LaTeX");
					}}
				/>
			</View>
		);
	};

	return (
		<Pressable onPress={() => inputRef.current?.focus()}>
			<View style={[styles.container, isFocused && styles.containerFocused]}>
				{!isFocused && (
					<View style={styles.mathWrapper} collapsable={false}>
						{renderMath()}
					</View>
				)}

				<TextInput
					ref={inputRef}
					style={[
						styles.input,
						!isFocused && styles.inputUnfocused,
						{
							fontFamily,
							fontSize,
							padding: isFocused ? padding : 0,
							color: isFocused ? theme.colors.text : "transparent",
							backgroundColor: isFocused ? undefined : "transparent",
						},
					]}
					selection={selection}
					onKeyPress={handleKeyPress}
					onSelectionChange={handleSelectionChange}
					onFocus={() => focusBlock(index)}
					onBlur={() => blurBlock()}
					multiline
					autoCapitalize="none"
					autoCorrect={false}
					value={value}
					onChangeText={handleChangeText}
					placeholder={isFocused ? "Enter LaTeX equation..." : ""}
					placeholderTextColor={theme.custom.editor.placeholder}
				/>
			</View>
		</Pressable>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			width: "100%",
			paddingVertical: 8,
			paddingHorizontal: 12,
			backgroundColor: theme.custom.editor.blockBackground,
			borderRadius: 8,
			borderWidth: 1.2,
			borderColor: theme.custom.editor.blockFocused || theme.colors.border,
			minHeight: 60,
			position: "relative",
		},
		containerFocused: {
			backgroundColor: theme.custom.editor.blockFocused || theme.colors.card,
			borderColor: theme.colors.primary,
		},
		mathWrapper: {
			width: "100%",
			alignItems: "center",
			justifyContent: "center",
			minHeight: 44,
		},
		mathContainer: {
			width: "100%",
			alignItems: "center",
			justifyContent: "center",
		},
		input: {
			position: "absolute",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			textAlignVertical: "top",
			...webMultilineTextInputReset,
		},
		inputUnfocused: {
			left: -9999,
			top: 0,
			right: -9998,
			bottom: 1,
			width: 1,
			height: 1,
		},
		emptyMath: {
			padding: 16,
			alignItems: "center",
			justifyContent: "center",
		},
		emptyText: {
			color: theme.custom.editor.placeholder,
			fontSize: 14,
			fontStyle: "italic",
		},
		errorContainer: {
			padding: 12,
			alignItems: "center",
		},
		errorText: {
			color: theme.colors.error,
			fontSize: 12,
			marginBottom: 8,
		},
	});
}
