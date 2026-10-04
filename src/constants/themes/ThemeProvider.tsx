import { createContext, type ReactNode, useContext } from "react";
import type { ExtendedTheme } from "./types";

const ThemeContext = createContext<ExtendedTheme | undefined>(undefined);

export function ThemeProvider({
	value,
	children,
}: {
	value: ExtendedTheme;
	children: ReactNode;
}) {
	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ExtendedTheme {
	const theme = useContext(ThemeContext);
	if (!theme) throw new Error("Missing Keeper ThemeProvider");
	return theme;
}
