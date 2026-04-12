import { withOpacity } from "@/utils/color";
import { DarkTheme as NavigationDarkTheme } from "@react-navigation/native";
import { darkCodeEditorTheme } from "./codeEditorTheme";
import { darkSyntaxTheme } from "./syntaxTheme";
import type { ExtendedTheme } from "./types";

const { colors } = NavigationDarkTheme;
export const darkTheme: ExtendedTheme = {
	...NavigationDarkTheme,
	colors: {
		...colors,
		error: "#f87171",
		textMuted: withOpacity(colors.text, 0.5),
		textSecondary: withOpacity(colors.text, 0.6),
		textFaded: withOpacity(colors.text, 0.375),
		textDisabled: withOpacity(colors.text, 0.25),
		primaryPressed: withOpacity(colors.primary, 0.8),
		shadow: "#000",
		primaryContrast: "#FFFFFF",
		statusSaving: "#fbbf24",
		statusSaved: "#4ade80",
	},
	typography: {
		heading1: {
			fontSize: 32,
			fontWeight: "bold",
			lineHeight: 40,
			color: NavigationDarkTheme.colors.text,
		},
		heading2: {
			fontSize: 24,
			fontWeight: "bold",
			lineHeight: 32,
			color: NavigationDarkTheme.colors.text,
		},
		heading3: {
			fontSize: 20,
			fontWeight: "600",
			lineHeight: 28,
			color: NavigationDarkTheme.colors.text,
		},
		body: {
			fontSize: 16,
			lineHeight: 24,
			color: NavigationDarkTheme.colors.text,
		},
	},
	custom: {
		syntax: darkSyntaxTheme,
		codeEditor: darkCodeEditorTheme,
		toast: { background: "#333", text: "#FFFFFF" },
		editor: {
			blockBackground: "#1E1E1E",
			blockFocused: "#252526",
			blockBorder: "#1AFFFFFF",
			placeholder: "#999999",
			inlineCode: {
				fontFamily: "monospace",
				backgroundColor: "#252526",
				color: darkSyntaxTheme.string,
			},
		},
	},
};
