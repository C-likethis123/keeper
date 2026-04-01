import { Platform, type TextStyle } from "react-native";

export const webMultilineTextInputReset: TextStyle =
	Platform.OS === "web"
		? {
				overflow: "hidden",
			}
		: {};
