import type { ExtendedTheme } from "@/constants/themes/types";
import { useMemo } from "react";
import { useExtendedTheme } from "./useExtendedTheme";

// Use this hook to create styles that needs to have access to the theme
// Do not use `useExtendedTheme` then `createStyles` in files
export function useStyles<T>(createStyles: (theme: ExtendedTheme) => T): T {
	const theme = useExtendedTheme();
	return useMemo(() => createStyles(theme), [createStyles, theme]);
}
