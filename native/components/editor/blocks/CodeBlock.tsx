import React, {
    useRef,
    useState,
    useCallback,
    useEffect,
    useMemo,
} from 'react';
import {
    View,
    TextInput,
    ScrollView,
    Text,
    StyleSheet,
    Pressable,
} from 'react-native';
import { BlockConfig } from './BlockRegistry';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';
import { CodeBlockHeader } from './CodeBlockHeader';
import { SyntaxHighlighter } from '../code/SyntaxHighlighter';
import { SmartEditingHandler } from '../code/SmartEditingHandler';
import { LanguageRegistry } from '../code/LanguageRegistry';
import * as Clipboard from 'expo-clipboard';

export function CodeBlock({
    block,
    onContentChange,
    onBackspaceAtStart,
    onDelete,
    onEnter,
    onFocus,
    onBlur,
    isFocused: isFocusedFromState,
    onBlockTypeChange,
    index,
}: BlockConfig) {
    const theme = useExtendedTheme();
    const inputRef = useRef<TextInput>(null);
    const codeScrollRef = useRef<ScrollView>(null);
    const lineNumberScrollRef = useRef<ScrollView>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const selectionRef = useRef({ start: 0, end: 0 });
    const [previousText, setPreviousText] = useState(block.content);

    const language = block.language ?? 'plaintext';
    const langConfig = LanguageRegistry.instance.getLanguage(language);
    const smartEditor = useMemo(
        () => new SmartEditingHandler(langConfig),
        [language, langConfig],
    );

    const handleFocus = useCallback(() => {
        setIsFocused(true);
        onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
        onBlur?.();
    }, [onBlur]);

    useEffect(() => {
        if (isFocusedFromState && inputRef.current) {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    inputRef.current?.focus();
                }, 0);
            });
        }
    }, [isFocusedFromState]);

    useEffect(() => {
        if (block.content !== previousText) {
            setPreviousText(block.content);
        }
    }, [block.content]);

    const handleCodeScroll = useCallback((event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        if (lineNumberScrollRef.current) {
            lineNumberScrollRef.current.scrollTo({ y: offsetY, animated: false });
        }
    }, []);

    const handleSelectionChange = useCallback((e: any) => {
        const newSelection = {
            start: e.nativeEvent.selection.start,
            end: e.nativeEvent.selection.end,
        };
        selectionRef.current = newSelection;
        setSelection(newSelection);
    }, []);

    const handleContentChange = useCallback(
        (newText: string) => {
            if (newText.length > previousText.length) {
                const currentSelection = selectionRef.current;
                if (currentSelection.start === currentSelection.end) {
                    let cursor = currentSelection.start;
                    
                    // Calculate cursor position: if text length increased by 1, cursor moved forward by 1
                    // This handles the case where onSelectionChange hasn't fired yet
                    if (newText.length === previousText.length + 1) {
                        // If cursor was at the end, it's now at the new end
                        if (cursor === previousText.length) {
                            cursor = newText.length;
                        } else {
                            // Otherwise, cursor moved forward by 1
                            cursor = cursor + 1;
                        }
                    } else {
                        // For multi-character inserts (paste), try to find the insertion point
                        // by comparing the texts
                        let diffStart = 0;
                        while (diffStart < previousText.length && 
                               diffStart < newText.length && 
                               previousText[diffStart] === newText[diffStart]) {
                            diffStart++;
                        }
                        cursor = diffStart + (newText.length - previousText.length);
                    }
                    
                    if (cursor > 0 && cursor <= newText.length) {
                        const insertedChar = newText[cursor - 1];
                        if (insertedChar && '{(["\'`'.includes(insertedChar)) {
                            const textWithoutInsert = newText.substring(0, cursor - 1) + newText.substring(cursor);
                            const result = smartEditor.handleCharacterInsert(
                                insertedChar,
                                textWithoutInsert,
                                cursor - 1,
                            );
                            if (result.handled && result.newText !== newText) {
                                setPreviousText(result.newText);
                                
                                // Update TextInput directly with both text and selection atomically
                                if (inputRef.current) {
                                    inputRef.current.setNativeProps({
                                        text: result.newText,
                                        selection: {
                                            start: result.newCursorOffset,
                                            end: result.newCursorOffset,
                                        },
                                    });
                                    selectionRef.current = { start: result.newCursorOffset, end: result.newCursorOffset };
                                    setSelection({ start: result.newCursorOffset, end: result.newCursorOffset });
                                }
                                
                                // Update block.content after a microtask to ensure setNativeProps is applied first
                                Promise.resolve().then(() => {
                                    onContentChange(result.newText);
                                });
                                
                                return;
                            }
                        }
                    }
                }
            }

            setPreviousText(newText);
            onContentChange(newText);
        },
        [onContentChange, previousText, smartEditor],
    );

    const handleKeyPress = useCallback(
        (e: any) => {
            const key = e.nativeEvent.key;

            if (key === 'Escape') {
                inputRef.current?.blur();
                return;
            }

            if ((key === 'Enter' || key === 'Return') && selection.start === selection.end) {
                const result = smartEditor.handleEnter(block.content, selection.start);
                if (result.handled) {
                    onContentChange(result.newText);
                    setPreviousText(result.newText);
                    requestAnimationFrame(() => {
                        if (inputRef.current) {
                            inputRef.current.setNativeProps({
                                text: result.newText,
                                selection: {
                                    start: result.newCursorOffset,
                                    end: result.newCursorOffset,
                                },
                            });
                            setSelection({ start: result.newCursorOffset, end: result.newCursorOffset });
                        }
                    });
                    return;
                }
            }

            if (key === 'Tab') {
                const result = smartEditor.handleTab(block.content, selection.start, false);
                if (result.handled) {
                    onContentChange(result.newText);
                    setPreviousText(result.newText);
                    requestAnimationFrame(() => {
                        if (inputRef.current) {
                            inputRef.current.setNativeProps({
                                text: result.newText,
                                selection: {
                                    start: result.newCursorOffset,
                                    end: result.newCursorOffset,
                                },
                            });
                            setSelection({ start: result.newCursorOffset, end: result.newCursorOffset });
                        }
                    });
                    return;
                }
            }

            if (key === 'Backspace' && selection.start === selection.end) {
                const result = smartEditor.handleBackspace(block.content, selection.start);
                if (result.handled) {
                    onContentChange(result.newText);
                    setPreviousText(result.newText);
                    requestAnimationFrame(() => {
                        if (inputRef.current) {
                            inputRef.current.setNativeProps({
                                text: result.newText,
                                selection: {
                                    start: result.newCursorOffset,
                                    end: result.newCursorOffset,
                                },
                            });
                            setSelection({ start: result.newCursorOffset, end: result.newCursorOffset });
                        }
                    });
                    return;
                }
            }
        },
        [block.content, onContentChange, selection, smartEditor],
    );

    const handleLanguageChange = useCallback(
        (newLanguage: string) => {
            if (onBlockTypeChange) {
                onBlockTypeChange(index, block.type, newLanguage);
            }
        },
        [onBlockTypeChange, index, block.type],
    );

    const handleCopy = useCallback(async () => {
        await Clipboard.setStringAsync(block.content);
    }, [block.content]);

    const handleDelete = useCallback(() => {
        if (onDelete) {
            onDelete();
        } else {
            onBackspaceAtStart?.();
        }
    }, [onDelete, onBackspaceAtStart]);

    const lineCount = block.content.split('\n').length;
    const maxLineNumberDigits = Math.ceil(Math.log10(Math.max(1, lineCount) + 1));
    const lineNumberWidth = Math.max(40, maxLineNumberDigits * 8 + 24);

    const styles = useMemo(() => createStyles(theme, lineNumberWidth, isFocused), [theme, lineNumberWidth, isFocused]);

    return (
        <View style={styles.container}>
            <CodeBlockHeader
                selectedLanguage={language}
                onLanguageChanged={handleLanguageChange}
                onCopyPressed={handleCopy}
                onDelete={handleDelete}
            />
            <View style={styles.editorContainer}>
                <ScrollView
                  ref={lineNumberScrollRef}
                  style={styles.lineNumbersContainer}
                  contentContainerStyle={styles.lineNumbersContent}
                  scrollEnabled={false}
                  showsVerticalScrollIndicator={false}
                >
                    {Array.from({ length: lineCount }, (_, i) => (
                        <Text key={i} style={styles.lineNumber}>
                            {i + 1}
                        </Text>
                    ))}
                </ScrollView>

                <ScrollView
                    ref={codeScrollRef}
                    style={styles.codeScrollView}
                    contentContainerStyle={styles.codeScrollContent}
                    onScroll={handleCodeScroll}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator
                >
                    <View style={styles.codeEditorWrapper}>
                        <View style={styles.highlightedCode}>
                            <SyntaxHighlighter code={block.content} language={language} />
                        </View>

                        <TextInput
                            ref={inputRef}
                            style={[
                                styles.textInput
                            ]}
                            onPressIn={handleFocus}
                            value={block.content}
                            onChangeText={handleContentChange}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            onKeyPress={handleKeyPress}
                            onSelectionChange={handleSelectionChange}
                            multiline
                            textAlignVertical="top"
                            autoCorrect={false}
                            autoCapitalize="none"
                            spellCheck={false}
                            selectionColor={theme.custom.syntax.defaultText + '40'}
                            underlineColorAndroid="transparent"
                            caretHidden={false}
                        />
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>, lineNumberWidth: number, isFocused: boolean) {
    const borderColor = isFocused 
        ? theme.custom.codeEditor.border 
        : theme.colors.border
    
    return StyleSheet.create({
        container: {
            marginVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: borderColor,
            backgroundColor: theme.custom.codeEditor.background,
            overflow: 'hidden',
        },
        codeContainer: {
            padding: 8,
        },
        editorContainer: {
            flexDirection: 'row',
            backgroundColor: theme.custom.codeEditor.background,
        },
        lineNumbersContainer: {
            width: lineNumberWidth,
            flexShrink: 0,
            flexGrow: 0,
            borderRightWidth: 1,
            borderRightColor: borderColor,
            backgroundColor: theme.custom.codeEditor.background,
        },
        lineNumbersContent: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            alignSelf: 'flex-start',
        },
        lineNumber: {
            fontSize: 14,
            lineHeight: 21,
            color: theme.custom.syntax.comment,
            fontFamily: 'monospace',
            textAlign: 'right',
        },
        codeScrollView: {
            flex: 1,
        },
        codeScrollContent: {
            padding: 8,
        },
        codeEditorWrapper: {
            position: 'relative',
            minHeight: 100,
        },
        highlightedCode: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
            padding: 0,
            margin: 0,
            pointerEvents: 'none',
        },
        textInput: {
            fontSize: 14,
            lineHeight: 21,
            color: 'transparent',
            fontFamily: 'monospace',
            zIndex: 1,
            minHeight: 100,
            opacity: 0,
            height: 0,
        },
    });
}

