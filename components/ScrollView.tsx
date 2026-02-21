// A wrapper around the ScrollView component that handles platform specific bheaviour

import { useEffect, useState } from "react";
import { Dimensions, Keyboard, Platform, ScrollView as RnScrollView, ScrollViewProps as RnScrollViewProps, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOOLBAR_HEIGHT } from "./editor/editorConstants";

interface ScrollViewProps extends RnScrollViewProps {
}
export function ScrollView({
	children,
	...props
}: ScrollViewProps) {
	const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
		if (Platform.OS === "web") return;
		const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
			const w = Dimensions.get("window");
			setKeyboardHeight(w.height - e.endCoordinates.screenY);
		});
		const hideSub = Keyboard.addListener("keyboardDidHide", () =>
			setKeyboardHeight(0),
		);
		return () => {
			showSub.remove();
			hideSub.remove();
		};
	}, []);

	const insets = useSafeAreaInsets();

	const scrollContentStyle = [
		{
			paddingBottom:
				20 +
				insets.bottom +
				(keyboardHeight > 0 ? TOOLBAR_HEIGHT : 0),
		},
	];

	const scrollProps = {
		style: styles.scrollView,
		contentContainerStyle: scrollContentStyle,
		keyboardShouldPersistTaps: "handled" as const,
	};
	if (Platform.OS === "web") {
		return (
			<RnScrollView {...scrollProps} {...props}>
				{children}
			</RnScrollView>
		);
	}
	return (
		<KeyboardAwareScrollView
			{...scrollProps}
			{...props}
			enableOnAndroid
			enableResetScrollToCoords={false}
		>
			{children}
		</KeyboardAwareScrollView>
	);
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
});