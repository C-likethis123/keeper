import type { Theme } from "@react-navigation/native";
import type { TextStyle } from "react-native";

export type ExtendedThemeColors = Theme["colors"] & {
	error: string;
	textMuted: string;
	textFaded: string;
	textDisabled: string;
	primaryPressed: string;
};

export interface SyntaxTheme {
	background: string;
	defaultText: string;
	keyword: string;
	string: string;
	number: string;
	comment: string;
	function: string;
	typeOfVariable: string;
	variable: string;
	operator: string;
	punctuation: string;
	attribute: string;
	tag: string;
	getColorForClass: (className: string | null) => string;
}

export interface CodeEditorTheme {
	background: string;
	headerBackground: string;
	border: string;
	icon: string;
	dropdownText: string;
}

export interface Typography {
	heading1: TextStyle;
	heading2: TextStyle;
	heading3: TextStyle;
	body: TextStyle;
}

export interface ExtendedTheme extends Omit<Theme, "colors"> {
	colors: ExtendedThemeColors;
	typography: Typography;
	custom: {
		syntax: SyntaxTheme;
		codeEditor: CodeEditorTheme;
		editor: {
			blockBackground: string;
			blockFocused: string;
			blockBorder: string;
			placeholder: string;
			inlineCode: {
				fontFamily: string;
				backgroundColor: string;
				color: string;
			};
		};
	};
}
