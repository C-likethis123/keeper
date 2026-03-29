import { Platform, type TextStyle } from "react-native";

export const webTextInputReset: TextStyle =
	Platform.OS === "web"
		? {
				outlineWidth: 0,
			}
		: {};

export const webMultilineTextInputReset: TextStyle =
	Platform.OS === "web"
		? {
				...webTextInputReset,
				overflow: "hidden",
			}
		: {};
