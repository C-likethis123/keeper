import type { CSSProperties } from "react";

export interface Theme {
	dark: boolean;
	colors: {
		primary: string;
		background: string;
		card: string;
		text: string;
		border: string;
		notification: string;
	};
	fonts: Record<
		"regular" | "medium" | "bold" | "heavy",
		{ fontFamily: string; fontWeight: NonNullable<CSSProperties["fontWeight"]> }
	>;
}

export type ExtendedThemeColors = Theme["colors"] & {
	error: string;
	textMuted: string;
	textSecondary: string;
	textFaded: string;
	textDisabled: string;
	primaryPressed: string;
	shadow: string;
	primaryContrast: string;
	statusSaving: string;
	statusSaved: string;
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
	headerText: string;
	border: string;
	icon: string;
	dropdownText: string;
}

export interface Typography {
	heading1: CSSProperties;
	heading2: CSSProperties;
	heading3: CSSProperties;
	body: CSSProperties;
}

export interface ExtendedTheme extends Omit<Theme, "colors"> {
	colors: ExtendedThemeColors;
	typography: Typography;
	custom: {
		syntax: SyntaxTheme;
		codeEditor: CodeEditorTheme;
		toast: { background: string; text: string };
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
