import { useVerticalArrowNavigation } from "@/components/editor/keyboard/useVerticalArrowNavigation";
import { webMultilineTextInputReset } from "@/components/shared/textInputWebStyles";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorBlockSelection, useEditorState } from "@/stores/editorStore";
import * as Clipboard from "expo-clipboard";
import React, {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type NativeSyntheticEvent,
	Platform,
	Pressable,
	type ScrollView,
	StyleSheet,
	TextInput,
	type TextInputKeyPressEventData,
	type TextInputScrollEventData,
	type TextInputSelectionChangeEventData,
	View,
} from "react-native";
import * as Braces from "../code/Braces";
import { LanguageRegistry } from "../code/LanguageRegistry";
import { SmartEditingHandler } from "../code/SmartEditingHandler";
import { BlockType, getBlockLanguage } from "../core/BlockNode";
import type { BlockConfig } from "./BlockRegistry";
import { CodeBlockHeader } from "./CodeBlockHeader";

const LazySyntaxHighlighter = React.lazy(
	() => import("../code/SyntaxHighlighter"),
);

type TextSelection = { start: number; end: number };
type EditResult = { newText: string; newCursorOffset: number };

function cursorSelection(offset: number): TextSelection {
	return { start: offset, end: offset };
}

function isSameSelection(a: TextSelection, b: TextSelection): boolean {
	return a.start === b.start && a.end === b.end;
}

function setCodeInputSelection(
	input: TextInput | null,
	selection: TextSelection,
) {
	if (!input) {
		return;
	}

	if (Platform.OS === "web") {
		const el = input as unknown as HTMLTextAreaElement;
		if (typeof el.setSelectionRange === "function") {
			el.setSelectionRange(selection.start, selection.end);
		}
		return;
	}

	input.setNativeProps?.({ selection });
}

export function CodeBlock({
	block,
	index,
	onContentChange,
	onBackspaceAtStart,
	onDelete,
	isFocused,
	onEnter,
	onSelectionChange,
	onBlockTypeChange,
}: BlockConfig) {
	const inputRef = useRef<TextInput>(null);
	const [value, setValue] = useState(block.content);
	const highlighterRef = useRef<ScrollView>(null);
	const [selection, setSelection] = useState<TextSelection>({
		start: 0,
		end: 0,
	});
	// Tracks the cursor position native currently holds, so we can skip redundant setNativeProps
	// calls on every keystroke and only intervene when external navigation requires a cursor jump.
	const nativeSelectionRef = useRef<TextSelection>({
		start: 0,
		end: 0,
	});
	const prevIsFocusedRef = useRef(false);
	const { focusBlockAt, blurBlock } = useFocusBlock();
	const selectionRange = useEditorBlockSelection(index);
	const getFocusedBlockIndex = useEditorState(
		(state) => state.getFocusedBlockIndex,
	);
	const handleVerticalArrow = useVerticalArrowNavigation(index, selection);
	const language = getBlockLanguage(block) ?? "plaintext";
	const languageRegistry = LanguageRegistry.instance;
	const languageConfig = useMemo(() => {
		return languageRegistry.getLanguage(language);
	}, [language, languageRegistry]);

	const editingHandler = useMemo(() => {
		return new SmartEditingHandler(languageConfig);
	}, [languageConfig]);

	useEffect(() => {
		onContentChange(index, value);
	}, [onContentChange, index, value]);

	const applySelectionToInput = useCallback(
		(nextSelection: TextSelection) => {
			nativeSelectionRef.current = nextSelection;
			setCodeInputSelection(inputRef.current, nextSelection);
		},
		[],
	);

	useEffect(() => {
		if (!isFocused || !selectionRange) {
			return;
		}
		setSelection((current) => {
			if (
				current.start === selectionRange.start &&
				current.end === selectionRange.end
			) {
				return current;
			}
			return selectionRange;
		});
		// Only move the native cursor when the store is asking for a position different
		// from where native already is (e.g. undo/redo or cross-block arrow navigation),
		// not on every keystroke echo from the store round-trip.
		if (!isSameSelection(nativeSelectionRef.current, selectionRange)) {
			applySelectionToInput(selectionRange);
		}
	}, [isFocused, selectionRange, applySelectionToInput]);

	useLayoutEffect(() => {
		if (isFocused && !prevIsFocusedRef.current) {
			inputRef.current?.focus();
		}
		prevIsFocusedRef.current = isFocused;
	}, [isFocused]);

	const setSelectionAndSync = useCallback(
		(nextSelection: TextSelection) => {
			setSelection(nextSelection);
			onSelectionChange?.(index, nextSelection.start, nextSelection.end);
		},
		[index, onSelectionChange],
	);

	const handleScroll = (e: NativeSyntheticEvent<TextInputScrollEventData>) => {
		const nativeOffsetY = e.nativeEvent.contentOffset?.y;
		const webTarget = e.currentTarget as unknown as { scrollTop?: number };
		const y =
			typeof nativeOffsetY === "number"
				? nativeOffsetY
				: (webTarget.scrollTop ?? 0);
		highlighterRef.current?.scrollTo({ y, animated: false });
	};

	const handleEnterKey = (
		val: string,
	): EditResult => {
		// onKeyPress fires before the character is inserted, so selection.start is the cursor
		// position before Enter was pressed — that's exactly where the newline sits in val.
		// SmartEditingHandler expects to receive the pre-newline text and re-inserts it itself.
		const newlinePosition = selection.start;
		const textBeforeNewline = val.substring(0, newlinePosition);
		const textAfterNewline = val.substring(newlinePosition + 1);
		const textWithoutNewline = textBeforeNewline + textAfterNewline;
		const cursorBeforeNewline = newlinePosition;

		// Use SmartEditingHandler to handle the Enter key
		// It expects the cursor position before the newline was inserted
		const result = editingHandler.handleEnter(
			textWithoutNewline,
			cursorBeforeNewline,
		);

		if (result.handled) {
			return {
				newText: result.newText,
				newCursorOffset: result.newCursorOffset,
			};
		}

		// Fallback to original behavior if not handled
		// Reconstruct with the newline that React Native inserted
		return { newText: val, newCursorOffset: newlinePosition + 1 };
	};

	const handleBraceInsert = (
		val: string,
		key: string,
	): EditResult => {
		const cursorPosition = selection.start;
		const textWithoutInsertedCharacter =
			val.substring(0, cursorPosition) + val.substring(cursorPosition + 1);
		const result = editingHandler.handleCharacterInsert(
			key,
			textWithoutInsertedCharacter,
			cursorPosition,
		);

		if (result.handled) {
			return {
				newText: result.newText,
				newCursorOffset: result.newCursorOffset,
			};
		}

		// handleCharacterInsert decided not to handle this character (e.g. angle bracket,
		// or a quote where auto-complete is not appropriate). React Native has already
		// inserted the character at cursorPosition in val — just advance the cursor past it.
		return { newText: val, newCursorOffset: cursorPosition + 1 };
	};

	const handleSelectionChange = (
		e: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
	) => {
		const sel = e.nativeEvent.selection;
		nativeSelectionRef.current = sel;
		setSelectionAndSync(sel);
	};

	const commitEditedText = useCallback(
		(resolveEdit: (currentValue: string) => EditResult) => {
			setValue((curr) => {
				const result = resolveEdit(curr);
				setTimeout(() => {
					const nextSelection = cursorSelection(result.newCursorOffset);
					setSelectionAndSync(nextSelection);
					applySelectionToInput(nextSelection);
				}, 0);
				return result.newText;
			});
		},
		[applySelectionToInput, setSelectionAndSync],
	);

	const handleFocus = useCallback(() => {
		if (isFocused) {
			return;
		}
		focusBlockAt(index, selection.end);
	}, [focusBlockAt, index, isFocused, selection.end]);

	const handleBlur = useCallback(() => {
		const currentFocus = getFocusedBlockIndex();
		if (currentFocus === index) {
			blurBlock();
		}
	}, [blurBlock, getFocusedBlockIndex, index]);

	const handleKeyPress = (
		e: NativeSyntheticEvent<TextInputKeyPressEventData>,
	) => {
		const key = e.nativeEvent.key;

		if (handleVerticalArrow(key)) {
			if (Platform.OS === "web") {
				e.preventDefault();
			}
			return;
		}
		const isShiftModified = Boolean(
			(
				e.nativeEvent as TextInputKeyPressEventData & {
					shiftKey?: boolean;
				}
			).shiftKey,
		);
		switch (key) {
			case "Enter":
				if (isShiftModified) {
					return;
				}
				setTimeout(() => {
					commitEditedText(handleEnterKey);
				}, 10);
				break;
			default:
				if (Braces.isOpenBrace(key)) {
					setTimeout(() => {
						commitEditedText((curr) => handleBraceInsert(curr, key));
					}, 0);
				}
				break;
		}
	};

	const handleCopy = async () => {
		try {
			await Clipboard.setStringAsync(value);
		} catch (error) {
			// Silently handle clipboard errors - user can try again if needed
			console.error("Failed to copy to clipboard:", error);
		}
	};

	const fontSize = 16;
	const lineHeight = 22;
	const padding = 16;
	const lineNumbersPadding = 1.75 * fontSize;
	const fontFamily = Platform.OS === "ios" ? "Menlo-Regular" : "monospace";

	return (
		<Pressable onPress={() => inputRef.current?.focus()}>
			<CodeBlockHeader
				selectedLanguage={language}
				onLanguageChanged={(language) => {
					onBlockTypeChange?.(index, BlockType.codeBlock, language);
				}}
				onCopyPressed={handleCopy}
				onDelete={() => onDelete(index)}
			/>
			<View>
				<React.Suspense fallback={<View style={styles.highlighterFallback} />}>
					<LazySyntaxHighlighter
						language={language}
						showLineNumbers
						scrollEnabled={false}
						addedStyle={{
							fontFamily,
							fontSize,
							padding,
							paddingLeft: lineNumbersPadding,
							highlighterLineHeight: lineHeight,
						}}
						ref={highlighterRef}
					>
						{value}
					</LazySyntaxHighlighter>
				</React.Suspense>
				<TextInput
					ref={inputRef}
					style={[
						styles.input,
						{
							color: "#FFFFFF00",
							fontFamily,
							fontSize,
							lineHeight,
							includeFontPadding: false,
							padding: 0,
							paddingTop: padding,
							paddingRight: padding,
							paddingBottom: padding,
							paddingLeft: lineNumbersPadding,
						},
					]}
					onScroll={handleScroll}
					onKeyPress={handleKeyPress}
					onSelectionChange={handleSelectionChange}
					onFocus={handleFocus}
					onBlur={handleBlur}
					multiline
					autoCapitalize="none"
					autoCorrect={false}
					value={value}
					onChangeText={setValue}
				/>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	highlighterFallback: {
		minHeight: 56,
	},
	input: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		textAlignVertical: "top",
		padding: 0,
		...webMultilineTextInputReset,
	},
});
