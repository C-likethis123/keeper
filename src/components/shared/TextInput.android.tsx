import React, { forwardRef } from "react";
import {
	TextInput as NativeTextInput,
	type TextInputProps as NativeTextInputProps,
} from "react-native";

export type TextInputProps = NativeTextInputProps & {
	autoGrow?: boolean;
};

const TextInput = forwardRef<NativeTextInput, TextInputProps>(
	({ autoGrow: _autoGrow, ...props }, ref) => {
		return <NativeTextInput ref={ref} {...props} />;
	},
);

TextInput.displayName = "TextInput";

export default TextInput;
