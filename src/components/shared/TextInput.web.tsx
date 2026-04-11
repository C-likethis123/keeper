import React, {
	forwardRef,
	useCallback,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	TextInput as NativeTextInput,
	type TextInputProps as NativeTextInputProps,
	StyleSheet,
} from "react-native";

type HtmlTextAreaInput = NativeTextInput & {
	scrollHeight?: number;
	style?: CSSStyleDeclaration;
};

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
			...props
		},
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

		const syncHeight = useCallback(() => {
			if (!autoGrow || !multiline || typeof HTMLElement === "undefined") {
				return;
			}

			requestAnimationFrame(() => {
				const node = inputRef.current as HtmlTextAreaInput | null;
				if (!(node instanceof HTMLElement)) {
					return;
				}
				const previousHeight = node.style.height;
				node.style.height = "auto";
				const nextHeight = Math.max(
					minHeight,
					Math.min(node.scrollHeight ?? minHeight, maxHeight),
				);
				node.style.height = previousHeight;
				setMeasuredHeight((currentHeight) =>
					currentHeight !== undefined &&
					Math.abs(currentHeight - nextHeight) < 1
						? currentHeight
						: nextHeight,
				);
			});
		}, [autoGrow, maxHeight, minHeight, multiline]);

		useLayoutEffect(() => {
			syncHeight();
		}, [syncHeight]);

		const handleChangeText = useCallback(
			(text: string) => {
				onChangeText?.(text);
				syncHeight();
			},
			[onChangeText, syncHeight],
		);

		const handleContentSizeChange = useCallback<
			NonNullable<TextInputProps["onContentSizeChange"]>
		>(
			(event) => {
				onContentSizeChange?.(event);
				syncHeight();
			},
			[onContentSizeChange, syncHeight],
		);

		const handleFocus = useCallback<NonNullable<TextInputProps["onFocus"]>>(
			(event) => {
				onFocus?.(event);
				syncHeight();
			},
			[onFocus, syncHeight],
		);

		return (
			<NativeTextInput
				ref={inputRef}
				{...props}
				multiline={multiline}
				onChangeText={handleChangeText}
				onContentSizeChange={handleContentSizeChange}
				onFocus={handleFocus}
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
