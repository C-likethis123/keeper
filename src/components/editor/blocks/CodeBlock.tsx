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
	type TextStyle,
	View,
} from "react-native";
import * as Braces from "../code/Braces";
import { LanguageRegistry } from "../code/LanguageRegistry";
import { SmartEditingHandler } from "../code/SmartEditingHandler";
import { BlockType, getBlockLanguage } from "../core/BlockNode";
import {
	registerPendingDispatchFlusher,
	unregisterPendingDispatchFlusher,
} from "../core/pendingDispatchRegistry";
import type { BlockConfig } from "./BlockRegistry";
import { CodeBlockHeader } from "./CodeBlockHeader";

const LazySyntaxHighlighter = React.lazy(
	() => import("../code/SyntaxHighlighter"),
);

type TextSelection = { start: number; end: number };
type EditResult = { newText: string; newCursorOffset: number };
type WebCodeInputStyle = TextStyle & {
	fontKerning?: "none";
	fontVariantLigatures?: "none";
	tabSize?: number;
	whiteSpace?: "pre-wrap";
};

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

function setCodeInputText(input: TextInput | null, text: string) {
	if (!input) {
		return;
	}

	if (Platform.OS === "web") {
		const el = input as unknown as HTMLTextAreaElement;
		if ("value" in el) {
			el.value = text;
		}
		return;
	}

	input.setNativeProps?.({ text });
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
	const localContentRef = useRef(block.content);
	// Tracks the cursor position native currently holds. The TextInput is uncontrolled
	// during typing, so this ref is the bridge between native selection and editor state.
	const nativeSelectionRef = useRef<TextSelection>({
		start: 0,
		end: 0,
	});
	const forcedSelectionRef = useRef<TextSelection | null>(null);
	const forcedSelectionTimeoutRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
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

	const applySelectionToInput = useCallback((nextSelection: TextSelection) => {
		nativeSelectionRef.current = nextSelection;
		setSelection(nextSelection);
		setCodeInputSelection(inputRef.current, nextSelection);
	}, []);

	useLayoutEffect(() => {
		if (block.content === localContentRef.current) {
			return;
		}
		localContentRef.current = block.content;
		setValue(block.content);
		setCodeInputText(inputRef.current, block.content);
	}, [block.content]);

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
			if (Platform.OS === "web") {
				const el = inputRef.current as unknown as HTMLTextAreaElement | null;
				if (el && document.activeElement !== el) {
					el.focus();
				}
			} else {
				inputRef.current?.focus();
			}
		}
		prevIsFocusedRef.current = isFocused;
	}, [isFocused]);

	const setSelectionAndSync = useCallback(
		(nextSelection: TextSelection) => {
			nativeSelectionRef.current = nextSelection;
			setSelection(nextSelection);
			onSelectionChange?.(index, nextSelection.start, nextSelection.end);
		},
		[index, onSelectionChange],
	);

	const flushPendingDispatch = useCallback(() => {
		const text = localContentRef.current;
		const sel = nativeSelectionRef.current;
		const storeBlock = useEditorState.getState().document.blocks[index];
		if (storeBlock && storeBlock.content !== text) {
			onContentChange(index, text, sel.end);
		} else {
			onSelectionChange?.(index, sel.start, sel.end);
		}
	}, [index, onContentChange, onSelectionChange]);

	useEffect(() => {
		registerPendingDispatchFlusher(block.id, flushPendingDispatch);
		return () => unregisterPendingDispatchFlusher(block.id, flushPendingDispatch);
	}, [block.id, flushPendingDispatch]);

	useEffect(() => {
		return () => {
			if (forcedSelectionTimeoutRef.current) {
				clearTimeout(forcedSelectionTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (Platform.OS !== "web" || !isFocused) {
			return;
		}

		const handleDocumentSelectionChange = () => {
			const el = inputRef.current as unknown as HTMLTextAreaElement | null;
			if (!el || document.activeElement !== el || el.selectionStart == null) {
				return;
			}
			const nextSelection = {
				start: el.selectionStart,
				end: el.selectionEnd ?? el.selectionStart,
			};
			if (isSameSelection(nativeSelectionRef.current, nextSelection)) {
				return;
			}
			setSelectionAndSync(nextSelection);
		};

		document.addEventListener("selectionchange", handleDocumentSelectionChange);
		return () => {
			document.removeEventListener(
				"selectionchange",
				handleDocumentSelectionChange,
			);
		};
	}, [isFocused, setSelectionAndSync]);

	const handleScroll = (e: NativeSyntheticEvent<TextInputScrollEventData>) => {
		const nativeOffsetY = e.nativeEvent.contentOffset?.y;
		const webTarget = e.currentTarget as unknown as { scrollTop?: number };
		const y =
			typeof nativeOffsetY === "number"
				? nativeOffsetY
				: (webTarget.scrollTop ?? 0);
		highlighterRef.current?.scrollTo({ y, animated: false });
	};

	const handleEnterKey = (val: string): EditResult => {
		const cursorPosition = selection.start;
		const selectionEnd = selection.end;
		const result = editingHandler.handleEnter(val, cursorPosition);

		if (result.handled) {
			return {
				newText: result.newText,
				newCursorOffset: result.newCursorOffset,
			};
		}

		return {
			newText: `${val.substring(0, cursorPosition)}\n${val.substring(selectionEnd)}`,
			newCursorOffset: cursorPosition + 1,
		};
	};

	const handleBraceInsert = (text: string, key: string): EditResult => {
		const cursorPosition = selection.start;
		const selectionEnd = selection.end;
		if (selectionEnd > cursorPosition) {
			const closeBrace = Braces.getCloseBrace(key);
			return {
				newText:
					text.substring(0, cursorPosition) +
					key +
					text.substring(cursorPosition, selectionEnd) +
					closeBrace +
					text.substring(selectionEnd),
				newCursorOffset: selectionEnd + 2,
			};
		}
		const result = editingHandler.handleCharacterInsert(
			key,
			text,
			cursorPosition,
		);

		if (result.handled) {
			return {
				newText: result.newText,
				newCursorOffset: result.newCursorOffset,
			};
		}

		// handleCharacterInsert decided not to handle this character (e.g. angle bracket,
		// or a quote where auto-complete is not appropriate).
		return {
			newText:
				text.substring(0, cursorPosition) +
				key +
				text.substring(cursorPosition),
			newCursorOffset: cursorPosition + 1,
		};
	};

	const handleSelectionChange = (
		e: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
	) => {
		const sel = e.nativeEvent.selection;
		nativeSelectionRef.current = sel;

		const forcedSelection = forcedSelectionRef.current;
		if (forcedSelection) {
			if (isSameSelection(sel, forcedSelection)) {
				forcedSelectionRef.current = null;
				if (forcedSelectionTimeoutRef.current) {
					clearTimeout(forcedSelectionTimeoutRef.current);
					forcedSelectionTimeoutRef.current = null;
				}
			} else {
				applySelectionToInput(forcedSelection);
				return;
			}
		}

		setSelectionAndSync(sel);
	};

	const commitEditedText = useCallback(
		(resolveEdit: (currentValue: string) => EditResult) => {
			setValue((curr) => {
				const result = resolveEdit(curr);
				const nextSelection = cursorSelection(result.newCursorOffset);
				localContentRef.current = result.newText;
				setCodeInputText(inputRef.current, result.newText);
				forcedSelectionRef.current = nextSelection;
				if (forcedSelectionTimeoutRef.current) {
					clearTimeout(forcedSelectionTimeoutRef.current);
				}
				forcedSelectionTimeoutRef.current = setTimeout(() => {
					forcedSelectionRef.current = null;
					forcedSelectionTimeoutRef.current = null;
				}, 100);
				setSelectionAndSync(nextSelection);
				onContentChange(index, result.newText, result.newCursorOffset);
				setTimeout(() => {
					applySelectionToInput(nextSelection);
				}, 0);
				return result.newText;
			});
		},
		[applySelectionToInput, index, onContentChange, setSelectionAndSync],
	);

	const handleContentChange = useCallback(
		(newText: string) => {
			const previousText = localContentRef.current;
			const previousSelection = nativeSelectionRef.current;
			localContentRef.current = newText;
			setValue(newText);

			let nextSelection = previousSelection;
			if (Platform.OS === "web") {
				const el = inputRef.current as unknown as HTMLTextAreaElement | null;
				if (el?.selectionStart != null) {
					nextSelection = {
						start: el.selectionStart,
						end: el.selectionEnd ?? el.selectionStart,
					};
				}
			} else {
				const selectedLength = Math.max(
					0,
					previousSelection.end - previousSelection.start,
				);
				const insertedLength =
					newText.length - (previousText.length - selectedLength);
				const cursorOffset =
					selectedLength > 0
						? previousSelection.start + Math.max(0, insertedLength)
						: previousSelection.end + (newText.length - previousText.length);
				const clampedOffset = Math.max(
					0,
					Math.min(newText.length, cursorOffset),
				);
				nextSelection = cursorSelection(clampedOffset);
			}

			setSelectionAndSync(nextSelection);
			onContentChange(index, newText, nextSelection.end);
		},
		[index, onContentChange, setSelectionAndSync],
	);

	const handleFocus = useCallback(() => {
		if (isFocused) {
			return;
		}
		if (Platform.OS === "web") {
			const el = inputRef.current as unknown as HTMLTextAreaElement | null;
			const offset = el?.selectionStart ?? selection.end;
			const nextSelection = {
				start: offset,
				end: el?.selectionEnd ?? offset,
			};
			nativeSelectionRef.current = nextSelection;
			setSelection(nextSelection);
			focusBlockAt(index, nextSelection.end);
			return;
		}
		focusBlockAt(index, selection.end);
	}, [focusBlockAt, index, isFocused, selection.end]);

	const handleBlur = useCallback(() => {
		flushPendingDispatch();
		const currentFocus = getFocusedBlockIndex();
		if (currentFocus === index) {
			blurBlock();
		}
	}, [blurBlock, flushPendingDispatch, getFocusedBlockIndex, index]);

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
				e.preventDefault();
				commitEditedText(handleEnterKey);
				break;
			default:
				if (Braces.isOpenBrace(key)) {
					e.preventDefault();
					commitEditedText((curr) => handleBraceInsert(curr, key));
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
	const fontFamily =
		Platform.OS === "ios"
			? "Menlo-Regular"
			: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace";
	const webCodeInputStyle: WebCodeInputStyle =
		Platform.OS === "web"
			? {
					fontKerning: "none",
					fontVariantLigatures: "none",
					tabSize: 4,
					whiteSpace: "pre-wrap",
				}
			: {};

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
						showLineNumbers={false}
						scrollEnabled={false}
						addedStyle={{
							fontFamily,
							fontSize,
							padding,
							paddingLeft: padding,
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
							paddingLeft: padding,
							...webCodeInputStyle,
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
					defaultValue={block.content}
					onChangeText={handleContentChange}
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
