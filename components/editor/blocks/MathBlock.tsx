import { useEditorState } from '@/contexts/EditorContext';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';
import { useFocusBlock } from '@/hooks/useFocusBlock';
import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    NativeSyntheticEvent,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TextInputKeyPressEventData,
    TextInputSelectionChangeEventData,
    TouchableOpacity,
    View,
} from 'react-native';
import { BlockConfig } from './BlockRegistry';
import { MathView } from './MathView';

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
    const [selection, setSelection] = useState<{ start: number, end: number }>({ start: 0, end: 0 });
    const [renderError, setRenderError] = useState<string | null>(null);
    const editorState = useEditorState();
    const { focusBlock, blurBlock } = useFocusBlock();
    const theme = useExtendedTheme();

    // Sync value with block content when it changes externally
    useEffect(() => {
        if (block.content !== value) {
            setValue(block.content);
        }
    }, [block.content]);

    useEffect(() => {
        onContentChange(value);
    }, [onContentChange, value]);


    const handleSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        const sel = e.nativeEvent.selection;
        setSelection(sel);
        onSelectionChange?.(sel.start, sel.end);
    };

    const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
        const key = e.nativeEvent.key;

        if (key === 'ArrowUp') {
            const cursorOffset = selection.start;
            const textBeforeCursor = value.substring(0, cursorOffset);
            const currentLineIndex = textBeforeCursor.split('\n').length - 1;

            if (currentLineIndex === 0 && index > 0) {
                focusBlock(index - 1);
                return;
            }
        }

        if (key === 'ArrowDown') {
            const lines = value.split('\n');
            const cursorOffset = selection.start;
            const textBeforeCursor = value.substring(0, cursorOffset);
            const currentLineIndex = textBeforeCursor.split('\n').length - 1;

            if (currentLineIndex === lines.length - 1) {
                const document = editorState.document;
                if (index < document.blocks.length - 1) {
                    focusBlock(index + 1);
                    return;
                }
            }
        }

        if (key === 'Enter' || key === 'Return') {
            return;
        }

        if (key === 'Backspace' && selection.start === 0 && selection.end === 0 && value === '') {
            onBackspaceAtStart?.();
            return;
        }
    };

    const styles = useMemo(() => createStyles(theme), [theme]);

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
                        setRenderError(error || 'Invalid LaTeX');
                    }}
                />
            </View>
        );
    };

    const fontSize = 16;
    const padding = 16;
    const fontFamily = Platform.OS === 'ios' ? 'Menlo-Regular' : 'monospace';

    return (
        <TouchableOpacity onPress={() => inputRef.current?.focus()}>
            <View style={[
                styles.container,
                isFocused && styles.containerFocused,
            ]}>
                {!isFocused && (
                    <View style={styles.mathWrapper}>
                        {renderMath()}
                    </View>
                )}

                <TextInput
                    ref={inputRef}
                    style={[
                        styles.input,
                        {
                            fontFamily,
                            fontSize,
                            padding,
                            color: isFocused ? theme.colors.text : 'transparent',
                        },
                    ]}
                    selection={selection}
                    onKeyPress={handleKeyPress}
                    onSelectionChange={handleSelectionChange}
                    onFocus={() => focusBlock(index)}
                    onBlur={() => blurBlock()}
                    multiline
                    autoCapitalize='none'
                    autoCorrect={false}
                    value={value}
                    onChangeText={setValue}
                    placeholder="Enter LaTeX equation..."
                    placeholderTextColor={theme.custom.editor.placeholder}
                />
            </View>
        </TouchableOpacity>
    );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
    return StyleSheet.create({
        container: {
            width: '100%',
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: theme.custom.editor.blockBackground,
            borderRadius: 8,
            borderWidth: 1.2,
            borderColor: theme.custom.editor.blockFocused || theme.colors.border,
            minHeight: 60,
            position: 'relative',
        },
        containerFocused: {
            backgroundColor: theme.custom.editor.blockFocused || theme.colors.card,
            borderColor: theme.colors.primary,
        },
        mathWrapper: {
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
        },
        mathContainer: {
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
        },
        input: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            textAlignVertical: 'top',
        },
        emptyMath: {
            padding: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emptyText: {
            color: theme.custom.editor.placeholder,
            fontSize: 14,
            fontStyle: 'italic',
        },
        errorContainer: {
            padding: 12,
            alignItems: 'center',
        },
        errorText: {
            color: theme.colors.error,
            fontSize: 12,
            marginBottom: 8,
        },
    });
}

