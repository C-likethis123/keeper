import {
	webMultilineTextInputReset,
	webTextInputReset,
} from "@/components/shared/textInputWebStyles";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useFocusBlock } from "@/hooks/useFocusBlock";
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
	StyleSheet,
	Text,
	TextInput,
	type TextInputKeyPressEventData,
	TouchableOpacity,
	View,
} from "react-native";
import {
	getCollapsibleSummary,
	isCollapsibleExpanded,
} from "../core/BlockNode";
import { InlineMarkdown } from "../rendering/InlineMarkdown";
import type { BlockConfig } from "./BlockRegistry";

const bodyFontSize = 15;
const bodyFontFamily = Platform.OS === "ios" ? "Menlo-Regular" : "monospace";

export function CollapsibleBlock({
	block,
	index,
	isFocused,
	onContentChange,
	onAttributesChange,
	onBackspaceAtStart,
	onEnter,
	onSelectionChange,
	onDelete,
}: BlockConfig) {
	const theme = useExtendedTheme();
	const { focusBlock, blurBlock } = useFocusBlock();

	const summaryInputRef = useRef<TextInput>(null);
	const bodyInputRef = useRef<TextInput>(null);

	const [focusZone, setFocusZone] = useState<"summary" | "body">("summary");
	const [summaryValue, setSummaryValue] = useState(
		getCollapsibleSummary(block),
	);
	const [bodyValue, setBodyValue] = useState(block.content);
	const isExpanded = isCollapsibleExpanded(block);

	// Sync local state when block changes externally (e.g. undo/redo)
	useEffect(() => {
		const externalSummary = getCollapsibleSummary(block);
		if (externalSummary !== summaryValue) {
			setSummaryValue(externalSummary);
		}
	}, [block, summaryValue]);

	useEffect(() => {
		setBodyValue(block.content);
	}, [block.content]);

	const handleToggleExpand = useCallback(() => {
		onAttributesChange?.(index, {
			...block.attributes,
			isExpanded: !isExpanded,
		});
	}, [onAttributesChange, index, block.attributes, isExpanded]);

	const handleSummaryChange = useCallback(
		(text: string) => {
			setSummaryValue(text);
			onAttributesChange?.(index, {
				...block.attributes,
				summary: text,
			});
		},
		[onAttributesChange, index, block.attributes],
	);

	const handleSummaryKeyPress = useCallback(
		(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
			const key = e.nativeEvent.key;
			if (key === "Enter" || key === "Return") {
				if (isExpanded) {
					setFocusZone("body");
					bodyInputRef.current?.focus();
				} else {
					onEnter(index, summaryValue.length);
				}
				return;
			}
			if (key === "Backspace" && summaryValue === "" && !isExpanded) {
				onBackspaceAtStart(index);
			}
		},
		[isExpanded, summaryValue, onBackspaceAtStart, onEnter, index],
	);

	const handleBodyKeyPress = useCallback(
		(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
			const key = e.nativeEvent.key;
			if (key === "Backspace" && bodyValue === "") {
				setFocusZone("summary");
				summaryInputRef.current?.focus();
				return;
			}
			if ((key === "Enter" || key === "Return") && bodyValue === "") {
				onEnter(index, 0);
			}
		},
		[bodyValue, onEnter, index],
	);

	const styles = useMemo(() => createStyles(theme), [theme]);

	const chevron = isExpanded ? "▾" : "▸";

	return (
		<View style={[styles.container, isFocused && styles.containerFocused]}>
			<View style={styles.header}>
				<TouchableOpacity
					onPress={handleToggleExpand}
					style={styles.chevronButton}
					hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
				>
					<Text style={styles.chevron}>{chevron}</Text>
				</TouchableOpacity>

				{isFocused ? (
					<TextInput
						ref={summaryInputRef}
						style={styles.summaryInput}
						value={summaryValue}
						onChangeText={handleSummaryChange}
						onKeyPress={handleSummaryKeyPress}
						onFocus={() => {
							focusBlock(index);
							setFocusZone("summary");
						}}
						onBlur={blurBlock}
						placeholder="Section title..."
						placeholderTextColor={theme.custom.editor.placeholder}
						returnKeyType="next"
						blurOnSubmit={false}
					/>
				) : (
					<TouchableOpacity
						style={styles.summaryDisplay}
						onPress={() => focusBlock(index)}
					>
						{summaryValue.length > 0 ? (
							<InlineMarkdown text={summaryValue} style={styles.summaryText} />
						) : (
							<Text style={styles.summaryPlaceholder}>Section title...</Text>
						)}
					</TouchableOpacity>
				)}
			</View>

			{/* Body: shown when expanded */}
			{isExpanded && (
				<View style={styles.body}>
					{isFocused ? (
						<TextInput
							ref={bodyInputRef}
							style={styles.bodyInput}
							value={bodyValue}
							onChangeText={(text) => {
								setBodyValue(text);
								onContentChange(index, text);
							}}
							onKeyPress={handleBodyKeyPress}
							onFocus={() => {
								focusBlock(index);
								setFocusZone("body");
							}}
							onBlur={blurBlock}
							onSelectionChange={(e) => {
								const sel = e.nativeEvent.selection;
								onSelectionChange(index, sel.start, sel.end);
							}}
							multiline
							autoCapitalize="none"
							autoCorrect={false}
							placeholder="Section body..."
							placeholderTextColor={theme.custom.editor.placeholder}
						/>
					) : (
						<TouchableOpacity onPress={() => focusBlock(index)}>
							{bodyValue.length > 0 ? (
								bodyValue.split("\n\n").map((paragraph, i) => (
									<InlineMarkdown
										// biome-ignore lint/suspicious/noArrayIndexKey: static split, no reordering
										key={i}
										text={paragraph}
										style={styles.bodyParagraph}
									/>
								))
							) : (
								<Text style={styles.bodyPlaceholder}>Section body...</Text>
							)}
						</TouchableOpacity>
					)}
				</View>
			)}
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			paddingVertical: 6,
			paddingHorizontal: 14,
			marginHorizontal: 14,
			backgroundColor: theme.custom.editor.blockBackground,
			borderRadius: 8,
			borderWidth: 1,
			borderColor: theme.custom.editor.blockBorder,
		},
		containerFocused: {
			borderColor: theme.colors.primary,
			backgroundColor: theme.custom.editor.blockFocused,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			minHeight: 36,
		},
		chevronButton: {
			marginRight: 6,
			paddingVertical: 2,
		},
		chevron: {
			fontSize: 16,
			color: theme.colors.text,
			lineHeight: 20,
		},
		summaryInput: {
			flex: 1,
			fontSize: 15,
			fontWeight: "600",
			color: theme.colors.text,
			paddingVertical: 4,
			...webTextInputReset,
		},
		summaryDisplay: {
			flex: 1,
			justifyContent: "center",
			paddingVertical: 4,
		},
		summaryText: {
			fontSize: 15,
			fontWeight: "600",
			color: theme.colors.text,
		},
		summaryPlaceholder: {
			fontSize: 15,
			fontWeight: "600",
			color: theme.custom.editor.placeholder,
			fontStyle: "italic",
		},
		body: {
			marginTop: 4,
			paddingTop: 4,
			borderTopWidth: 1,
			borderTopColor: theme.custom.editor.blockBorder,
			paddingBottom: 4,
		},
		bodyInput: {
			fontSize: bodyFontSize,
			fontFamily: bodyFontFamily,
			color: theme.colors.text,
			textAlignVertical: "top",
			minHeight: 60,
			paddingVertical: 4,
			paddingHorizontal: 0,
			...webMultilineTextInputReset,
		},
		bodyParagraph: {
			fontSize: 14,
			color: theme.colors.text,
			marginBottom: 4,
			lineHeight: 20,
		},
		bodyPlaceholder: {
			fontSize: 14,
			color: theme.custom.editor.placeholder,
			fontStyle: "italic",
			paddingVertical: 4,
		},
	});
}
