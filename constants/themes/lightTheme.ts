import { withOpacity } from "@/utils/color";
import { DefaultTheme as NavigationLightTheme } from "@react-navigation/native";
import { lightCodeEditorTheme } from "./codeEditorTheme";
import { lightSyntaxTheme } from "./syntaxTheme";
import type { ExtendedTheme } from "./types";

const { colors } = NavigationLightTheme;
export const lightTheme: ExtendedTheme = {
	...NavigationLightTheme,
	colors: {
		...colors,
		error: "#ef4444",
		textMuted: withOpacity(colors.text, 0.5),
		textFaded: withOpacity(colors.text, 0.375),
		textDisabled: withOpacity(colors.text, 0.25),
		primaryPressed: withOpacity(colors.primary, 0.8),
		shadow: "#000",
		primaryContrast: "#FFFFFF",
		statusSaving: "#f59e0b",
		statusSaved: "#16a34a",
	},
	typography: {
		heading1: {
			fontSize: 32,
			fontWeight: "bold",
			lineHeight: 40,
			color: NavigationLightTheme.colors.text,
		},
		heading2: {
			fontSize: 24,
			fontWeight: "bold",
			lineHeight: 32,
			color: NavigationLightTheme.colors.text,
		},
		heading3: {
			fontSize: 20,
			fontWeight: "600",
			lineHeight: 28,
			color: NavigationLightTheme.colors.text,
		},
		body: {
			fontSize: 16,
			lineHeight: 24,
			color: NavigationLightTheme.colors.text,
		},
	},
	custom: {
		syntax: lightSyntaxTheme,
		codeEditor: lightCodeEditorTheme,
		toast: { background: "#374151", text: "#FFFFFF" },
		editor: {
			blockBackground: "#FFFFFF",
			blockFocused: "#F5F5F5",
			blockBorder: "#E0E0E0",
			placeholder: "#999999",
			inlineCode: {
				fontFamily: "monospace",
				backgroundColor: "#F5F5F5",
				color: lightSyntaxTheme.string,
			},
		},
	},
};
