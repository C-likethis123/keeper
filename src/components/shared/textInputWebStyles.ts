import { Platform, type TextStyle } from "react-native";

export const webMultilineTextInputReset: TextStyle =
	Platform.OS === "web"
		? {
				overflow: "hidden",
			}
		: {};

export const webTextInputReset: TextStyle =
	Platform.OS === "web"
		? {
				outline: "none",
			}
		: {};
