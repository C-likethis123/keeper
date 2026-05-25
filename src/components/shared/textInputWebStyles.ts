import { Platform, type TextStyle } from "react-native";

export const webMultilineTextInputReset: TextStyle =
	Platform.OS === "web"
		? {
				borderWidth: 0,
				margin: 0,
				outlineStyle: "none",
				overflow: "hidden",
				resize: "none",
			}
		: {};

export const webTextInputReset: TextStyle =
	Platform.OS === "web"
		? {
				outline: "none",
			}
		: {};
