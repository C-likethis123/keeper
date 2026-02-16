import { useFocusBlock } from '@/hooks/useFocusBlock';
import * as Clipboard from 'expo-clipboard';
import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    NativeSyntheticEvent,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TextInputKeyPressEventData,
    TextInputScrollEventData,
    TextInputSelectionChangeEventData,
    TouchableOpacity,
    View
} from 'react-native';
import * as Braces from '../code/Braces';
import * as Indentation from '../code/Indentation';
import { LanguageRegistry } from '../code/LanguageRegistry';
import { SmartEditingHandler } from '../code/SmartEditingHandler';
import SyntaxHighlighter from '../code/SyntaxHighlighter';
import { BlockType } from '../core';
import { BlockConfig } from './BlockRegistry';
import { CodeBlockHeader } from './CodeBlockHeader';

export function CodeBlock({
    block,
    index,
    onContentChange,
    onBackspaceAtStart,
    onDelete,
    onEnter,
    onSelectionChange,
    onBlockTypeChange,
}: BlockConfig) {
    const inputRef = useRef<TextInput>(null);
    const [value, setValue] = useState(block.content);
    const highlighterRef = useRef<ScrollView>(null);
    const [selection, setSelection] = useState<{ start: number, end: number }>({ start: 0, end: 0 });
    const { focusBlock, blurBlock, focusBlockIndex } = useFocusBlock();
    const isFocused = focusBlockIndex === index;
    const language = block.language ?? 'plaintext';
    const languageRegistry = LanguageRegistry.instance;
    const languageConfig = useMemo(() => {
        return languageRegistry.getLanguage(language);
    }, [language]);
    
    const editingHandler = useMemo(() => {
        return new SmartEditingHandler(languageConfig);
    }, [languageConfig]);

    useEffect(() => {
        onContentChange(value);
    }, [onContentChange, value]);

    const handleScroll = (e: NativeSyntheticEvent<TextInputScrollEventData>) => {
        const y = e.nativeEvent.contentOffset.y;
        highlighterRef.current?.scrollTo({ y, animated: false });
    };

    const handleEnterKey = (val: string): { newText: string; newCursorOffset: number } => {
        // When Enter is pressed, React Native has already inserted a newline at selection.start - 1
        // SmartEditingHandler expects to insert the newline itself, so we need to reconstruct
        // the text before the newline was inserted
        const newlinePosition = selection.start - 1;
        const textBeforeNewline = val.substring(0, newlinePosition);
        const textAfterNewline = val.substring(newlinePosition + 1);
        const textWithoutNewline = textBeforeNewline + textAfterNewline;
        const cursorBeforeNewline = newlinePosition;
        
        // Use SmartEditingHandler to handle the Enter key
        // It expects the cursor position before the newline was inserted
        const result = editingHandler.handleEnter(textWithoutNewline, cursorBeforeNewline);
        
        if (result.handled) {
            // Preserve the special brace pair logic from original implementation
            // Check if we're between a brace pair and add extra newline/indentation
            const leftChar = textBeforeNewline[cursorBeforeNewline - 1] || '';
            const rightChar = textAfterNewline[0] || '';
            
            if (Braces.isBracePair(leftChar, rightChar)) {
                // Calculate the indentation for the closing brace line
                const preLines = textBeforeNewline.split('\n');
                const indentSize = Indentation.getSuggestedIndentSize(preLines);
                const addedIndentionSize = Braces.isRegularBrace(leftChar)
                    ? Math.max(indentSize - Indentation.INDENT_SIZE, 0)
                    : indentSize;
                
                // Find where the newline was inserted in the result (should be at cursorBeforeNewline)
                const newlineIndex = result.newText.indexOf('\n', cursorBeforeNewline);
                if (newlineIndex !== -1) {
                    // Insert extra newline and indentation after the first newline
                    const beforeExtra = result.newText.substring(0, newlineIndex + 1);
                    const afterExtra = result.newText.substring(newlineIndex + 1);
                    const extraIndentation = '\n' + Indentation.createIndentString(addedIndentionSize);
                    const finalText = beforeExtra + extraIndentation + afterExtra;
                    
                    // Adjust cursor position to account for the extra content
                    const adjustedCursor = result.newCursorOffset + extraIndentation.length;
                    return { newText: finalText, newCursorOffset: adjustedCursor };
                }
            }
            
            return { newText: result.newText, newCursorOffset: result.newCursorOffset };
        }
        
        // Fallback to original behavior if not handled
        // Reconstruct with the newline that React Native inserted
        return { newText: val, newCursorOffset: newlinePosition + 1 };
    };

    const handleBraceInsert = (val: string, key: string): { newText: string; newCursorOffset: number } => {
        const cursorPosition = selection.start;
        const result = editingHandler.handleCharacterInsert(key, val, cursorPosition);
        
        if (result.handled) {
            return { newText: result.newText, newCursorOffset: result.newCursorOffset };
        }
        
        // Fallback: insert closing brace manually
        const closingBrace = Braces.getCloseBrace(key);
        if (closingBrace) {
            const newText = val.substring(0, cursorPosition) + key + closingBrace + val.substring(cursorPosition);
            return { newText, newCursorOffset: cursorPosition + 1 };
        }
        
        return { newText: val, newCursorOffset: cursorPosition };
    };

    const handleSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        const sel = e.nativeEvent.selection;
        setSelection(sel);
        onSelectionChange?.(sel.start, sel.end);
    };
    const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
        const key = e.nativeEvent.key;
        switch (key) {
            case 'Enter':
                setTimeout(() => {
                    setValue((curr) => {
                        const result = handleEnterKey(curr);
                        // Update cursor position after state update
                        setTimeout(() => {
                            setSelection({ start: result.newCursorOffset, end: result.newCursorOffset });
                        }, 0);
                        return result.newText;
                    });
                }, 10);
                break;
            default:
                if (Braces.isOpenBrace(key)) {
                    setTimeout(() => {
                        setValue((curr) => {
                            const result = handleBraceInsert(curr, key);
                            // Update cursor position after state update
                            setTimeout(() => {
                                setSelection({ start: result.newCursorOffset, end: result.newCursorOffset });
                            }, 0);
                            return result.newText;
                        });
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
            console.error('Failed to copy to clipboard:', error);
        }
    };

    const fontSize = 16;
    const padding = 16;
    const lineNumbersPadding = 1.75 * fontSize;
    const fontFamily = Platform.OS === 'ios' ? 'Menlo-Regular' : 'monospace';

    return (
        <TouchableOpacity onPress={() => inputRef.current?.focus()}>
            <CodeBlockHeader selectedLanguage={language} onLanguageChanged={(language) => { onBlockTypeChange?.(index, BlockType.codeBlock, language) }} onCopyPressed={handleCopy} onDelete={onDelete!} />
            <View>
                <SyntaxHighlighter language={language} showLineNumbers scrollEnabled={false} ref={highlighterRef}>
                    {value}
                </SyntaxHighlighter>
                <TextInput
                    ref={inputRef}
                    style={[styles.input, {
                        color: '#FFFFFF00',
                        fontFamily,
                        fontSize,
                        paddingTop: padding,
                        paddingRight: padding,
                        paddingBottom: padding,
                        paddingLeft: lineNumbersPadding,
                    }]}
                    onScroll={handleScroll}
                    selection={selection}
                    onKeyPress={handleKeyPress}
                    onSelectionChange={handleSelectionChange}
                    multiline
                    autoCapitalize='none'
                    autoCorrect={false}
                    value={value}
                    onChangeText={setValue}
                />
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    input: {
        position: 'absolute',
        textAlignVertical: 'top',
    },
});
