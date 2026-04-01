import React, {
	forwardRef,
	useCallback,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type NativeSyntheticEvent,
	TextInput as NativeTextInput,
	type TextInputProps as NativeTextInputProps,
	StyleSheet,
	type TextInputContentSizeChangeEventData,
} from "react-native";

export type TextInputProps = NativeTextInputProps & {
	autoGrow?: boolean;
};

const TextInput = forwardRef<NativeTextInput, TextInputProps>(
	(
		{ autoGrow = false, multiline, onContentSizeChange, style, ...props },
		ref,
	) => {
		const inputRef = useRef<NativeTextInput>(null);
		const [measuredHeight, setMeasuredHeight] = useState<number | undefined>(
			undefined,
		);
		const flatStyle = useMemo(() => StyleSheet.flatten(style) ?? {}, [style]);
		const minHeight =
			typeof flatStyle.minHeight === "number" ? flatStyle.minHeight : 0;
		const maxHeight =
			typeof flatStyle.maxHeight === "number"
				? flatStyle.maxHeight
				: Number.POSITIVE_INFINITY;

		useImperativeHandle(ref, () => inputRef.current as NativeTextInput, []);

		const handleContentSizeChange = useCallback(
			(event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
				onContentSizeChange?.(event);
				if (!autoGrow || !multiline) {
					return;
				}

				const nextHeight = Math.max(
					minHeight,
					Math.min(event.nativeEvent.contentSize.height, maxHeight),
				);
				setMeasuredHeight((currentHeight) =>
					currentHeight !== undefined &&
					Math.abs(currentHeight - nextHeight) < 1
						? currentHeight
						: nextHeight,
				);
			},
			[autoGrow, maxHeight, minHeight, multiline, onContentSizeChange],
		);

		return (
			<NativeTextInput
				ref={inputRef}
				{...props}
				multiline={multiline}
				onContentSizeChange={handleContentSizeChange}
				style={[
					style,
					autoGrow && multiline && measuredHeight !== undefined
						? { height: measuredHeight }
						: null,
				]}
			/>
		);
	},
);

TextInput.displayName = "TextInput";

export default TextInput;
