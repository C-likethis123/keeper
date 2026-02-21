// A wrapper around the ScrollView component that handles platform specific bheaviour

import { Platform, ScrollView as RnScrollView, ScrollViewProps as RnScrollViewProps, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

interface ScrollViewProps extends RnScrollViewProps {
}
export function ScrollView({
	children,
	...props
}: ScrollViewProps) {
	const scrollProps = {
		style: styles.scrollView,
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
            keyboardOpeningTime={0}
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