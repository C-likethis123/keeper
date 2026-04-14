import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  TextInput as NativeTextInput,
  type TextInputProps as NativeTextInputProps,
} from "react-native";

export type TextInputProps = NativeTextInputProps & {
  autoGrow?: boolean;
};

const TextInput = forwardRef<NativeTextInput, TextInputProps>(
  (
    {
      autoGrow = false,
      multiline,
      onChangeText,
      onContentSizeChange,
      onFocus,
      style,
      numberOfLines,
      ...props
    },
    ref,
  ) => {
    const inputRef = useRef<NativeTextInput>(null);

    useImperativeHandle(ref, () => inputRef.current as NativeTextInput, []);

    const handleChangeText = useCallback(
      (text: string) => {
        onChangeText?.(text);
      },
      [onChangeText],
    );

    const handleContentSizeChange = useCallback<
      NonNullable<TextInputProps["onContentSizeChange"]>
    >(
      (event) => {
        onContentSizeChange?.(event);
        // setNumberOfLines(event.nativeEvent.contentSize.height / 16);
      },
      [onContentSizeChange],
    );

    const handleFocus = useCallback<NonNullable<TextInputProps["onFocus"]>>(
      (event) => {
        onFocus?.(event);
      },
      [onFocus],
    );

    return (
      <NativeTextInput
        ref={inputRef}
        {...props}
        multiline={multiline}
        onChangeText={handleChangeText}
        onContentSizeChange={handleContentSizeChange}
        onFocus={handleFocus}
        numberOfLines={numberOfLines}
        style={[style]}
      />
    );
  },
);

TextInput.displayName = "TextInput";

export default TextInput;
