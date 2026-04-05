import { webMultilineTextInputReset } from "@/components/shared/textInputWebStyles";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorState } from "@/stores/editorStore";
import React, {
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	type TextInputKeyPressEvent,
	View,
} from "react-native";
import {
	getCollapsibleSummary,
	isCollapsibleExpanded,
} from "../core/BlockNode";
import { InlineMarkdown } from "../rendering/InlineMarkdown";
import type { BlockConfig } from "./BlockRegistry";

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
	const [summarySelection, setSummarySelection] = useState({
		start: 0,
		end: 0,
	});
	const [bodyValue, setBodyValue] = useState(block.content);
	const [bodySelection, setBodySelection] = useState({
		start: 0,
		end: 0,
	});
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

	useEffect(() => {
		if (isFocused && focusZone === "body" && isExpanded) {
			bodyInputRef.current?.focus();
		}
	}, [isFocused, focusZone, isExpanded]);

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
		(e: TextInputKeyPressEvent) => {
			const key = e.nativeEvent.key;
			if (key === "Enter" || key === "Return") {
				if (Platform.OS === "web") {
					e.preventDefault();
					e.stopPropagation();
				}
				if (!isExpanded) {
					onAttributesChange?.(index, {
						...block.attributes,
						isExpanded: true,
					});
				}
				setFocusZone("body");
				return;
			}
			if (key === "Backspace" && summaryValue === "") {
				onBackspaceAtStart(index);
			}
		},
		[
			isExpanded,
			onAttributesChange,
			index,
			block.attributes,
			summaryValue,
			onBackspaceAtStart,
		],
	);

	const getFocusedBlockIndex = useEditorState(
		(state) => state.getFocusedBlockIndex,
	);

	const handleBlur = useCallback(() => {
		// Only blur the block if the global selection is still pointing to this block
		// and we haven't just moved focus to another input within this same block.
		// On Web, the focus switch happens before the blur event usually.
		requestAnimationFrame(() => {
			const currentFocus = getFocusedBlockIndex();
			if (currentFocus === index) {
				// We need to check if focus is still within this block's inputs
				// This is hard on native, but on web we can check document.activeElement
				if (Platform.OS === "web" && typeof document !== "undefined") {
					const active = document.activeElement;
					if (
						active === summaryInputRef.current ||
						active === bodyInputRef.current
					) {
						return;
					}
				}
				// If we don't know for sure, we might want to wait a bit longer or trust the focus logic
				// For now, let's just NOT blur if we're in the middle of a zone transition
				blurBlock();
			}
		});
	}, [blurBlock, getFocusedBlockIndex, index]);

	const handleBodyKeyPress = useCallback(
		(e: TextInputKeyPressEvent) => {
			const key = e.nativeEvent.key;
			if (key === "Backspace" && bodyValue === "") {
				setFocusZone("summary");
				summaryInputRef.current?.focus();
				return;
			}
			if (key === "Enter" || key === "Return") {
				const { start } = bodySelection;
				const isAtEmptyLine =
					bodyValue === "" ||
					(start > 0 &&
						bodyValue[start - 1] === "\n" &&
						(start === bodyValue.length || bodyValue[start] === "\n")) ||
					(start === 0 && (bodyValue.length === 0 || bodyValue[0] === "\n"));

				if (isAtEmptyLine) {
					if (Platform.OS === "web") {
						e.preventDefault();
					}
					onEnter(index, start, "body");
				}
			}
		},
		[bodyValue, bodySelection, onEnter, index],
	);

	const styles = useStyles(createStyles);

	const chevron = isExpanded ? "▾" : "▸";

	return (
		<View style={[styles.container, isFocused && styles.containerFocused]}>
			<View style={styles.header}>
				<Pressable
					onPress={handleToggleExpand}
					style={styles.chevronButton}
					hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
				>
					<Text style={styles.chevron}>{chevron}</Text>
				</Pressable>

				{isFocused ? (
					<TextInput
						ref={summaryInputRef}
						style={styles.summaryInput}
						value={summaryValue}
						onChangeText={handleSummaryChange}
						onKeyPress={handleSummaryKeyPress}
						onSelectionChange={(e) => {
							setSummarySelection(e.nativeEvent.selection);
						}}
						onFocus={() => {
							focusBlock(index);
							setFocusZone("summary");
						}}
						onBlur={handleBlur}
						placeholder="Section title..."
						placeholderTextColor={theme.custom.editor.placeholder}
						returnKeyType="next"
						blurOnSubmit={false}
					/>
				) : (
					<Pressable
						style={styles.summaryDisplay}
						onPress={() => focusBlock(index)}
					>
						{summaryValue.length > 0 ? (
							<InlineMarkdown text={summaryValue} style={styles.summaryText} />
						) : (
							<Text style={styles.summaryPlaceholder}>Section title...</Text>
						)}
					</Pressable>
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
							onBlur={handleBlur}
							onSelectionChange={(e) => {
								const sel = e.nativeEvent.selection;
								setBodySelection(sel);
								onSelectionChange(index, sel.start, sel.end);
							}}
							multiline
							autoCapitalize="none"
							autoCorrect={false}
							placeholder="Section body..."
							placeholderTextColor={theme.custom.editor.placeholder}
						/>
					) : (
						<Pressable onPress={() => focusBlock(index)}>
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
						</Pressable>
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
			fontSize: 16,
			fontWeight: "600",
			color: theme.colors.text,
			paddingVertical: 4,
		},
		summaryDisplay: {
			flex: 1,
			justifyContent: "center",
			paddingVertical: 4,
		},
		summaryText: {
			fontSize: 16,
			fontWeight: "600",
			color: theme.colors.text,
		},
		summaryPlaceholder: {
			fontSize: 16,
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
			fontSize: 16,
			color: theme.colors.text,
			textAlignVertical: "top",
			minHeight: 60,
			paddingVertical: 4,
			paddingHorizontal: 0,
			...webMultilineTextInputReset,
		},
		bodyParagraph: {
			fontSize: 16,
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
