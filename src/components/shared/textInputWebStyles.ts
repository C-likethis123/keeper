import { Platform, type TextStyle } from "react-native";

export const webTextInputReset: TextStyle =
	Platform.OS === "web"
		? {
				outlineStyle: "none",
				outlineWidth: 0,
				boxShadow: "none",
			}
		: {};

export const webMultilineTextInputReset: TextStyle =
	Platform.OS === "web"
		? {
				...webTextInputReset,
				overflow: "hidden",
			}
		: {};
