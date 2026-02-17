import type { SyntaxTheme } from "./types";

function createGetColorForClass(
	theme: Omit<SyntaxTheme, "getColorForClass">,
): SyntaxTheme["getColorForClass"] {
	return (className: string | null) => {
		if (className == null) return theme.defaultText;

		if (className.includes("keyword")) return theme.keyword;
		if (className.includes("string")) return theme.string;
		if (className.includes("number")) return theme.number;
		if (className.includes("comment")) return theme.comment;
		if (className.includes("function")) return theme.function;
		if (className.includes("type") || className.includes("class"))
			return theme.typeOfVariable;
		if (className.includes("variable") || className.includes("params")) {
			return theme.variable;
		}
		if (className.includes("operator")) return theme.operator;
		if (className.includes("punctuation")) return theme.punctuation;
		if (className.includes("attr")) return theme.attribute;
		if (className.includes("tag")) return theme.tag;
		if (className.includes("built_in")) return theme.function;
		if (className.includes("literal")) return theme.keyword;
		if (className.includes("symbol")) return theme.variable;
		if (className.includes("title")) return theme.function;

		return theme.defaultText;
	};
}

// Dark theme (currently only one defined in Flutter)
export const darkSyntaxTheme: SyntaxTheme = {
	background: "#1E1E1E",
	defaultText: "#D4D4D4",
	keyword: "#569CD6",
	string: "#CE9178",
	number: "#B5CEA8",
	comment: "#6A9955",
	function: "#DCDCAA",
	typeOfVariable: "#4EC9B0",
	variable: "#9CDCFE",
	operator: "#D4D4D4",
	punctuation: "#D4D4D4",
	attribute: "#9CDCFE",
	tag: "#569CD6",
	getColorForClass: createGetColorForClass({
		background: "#1E1E1E",
		defaultText: "#D4D4D4",
		keyword: "#569CD6",
		string: "#CE9178",
		number: "#B5CEA8",
		comment: "#6A9955",
		function: "#DCDCAA",
		typeOfVariable: "#4EC9B0",
		variable: "#9CDCFE",
		operator: "#D4D4D4",
		punctuation: "#D4D4D4",
		attribute: "#9CDCFE",
		tag: "#569CD6",
	}),
};

// Light theme (to be defined - using similar colors but adjusted for light background)
export const lightSyntaxTheme: SyntaxTheme = {
	background: "#FFFFFF",
	defaultText: "#24292E",
	keyword: "#005CC5",
	string: "#032F62",
	number: "#005CC5",
	comment: "#6A737D",
	function: "#6F42C1",
	typeOfVariable: "#005CC5",
	variable: "#E36209",
	operator: "#D73A49",
	punctuation: "#24292E",
	attribute: "#005CC5",
	tag: "#22863A",
	getColorForClass: createGetColorForClass({
		background: "#FFFFFF",
		defaultText: "#24292E",
		keyword: "#005CC5",
		string: "#032F62",
		number: "#005CC5",
		comment: "#6A737D",
		function: "#6F42C1",
		typeOfVariable: "#005CC5",
		variable: "#E36209",
		operator: "#D73A49",
		punctuation: "#24292E",
		attribute: "#005CC5",
		tag: "#22863A",
	}),
};
