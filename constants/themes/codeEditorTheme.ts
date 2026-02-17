import type { CodeEditorTheme } from "./types";

// Dark theme
export const darkCodeEditorTheme: CodeEditorTheme = {
	background: "#1E1E1E",
	headerBackground: "#252526",
	border: "#1AFFFFFF", // white with 10% opacity
	icon: "#FFFFFFB3", // white with 70% opacity
	dropdownText: "#FFFFFFB3",
};

// Light theme
export const lightCodeEditorTheme: CodeEditorTheme = {
	background: "#2D2D2D",
	headerBackground: "#383838",
	border: "#0DFFFFFF", // white with 5% opacity
	icon: "#FFFFFFB3",
	dropdownText: "#FFFFFFB3",
};
