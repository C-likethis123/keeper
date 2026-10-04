import type { ReactNode } from "react";

/** Preserve existing browser layout, which has no native inset bridge. */
export function SafeAreaProvider({ children }: { children?: ReactNode }) {
	return <>{children}</>;
}

export function useSafeAreaInsets() {
	return { top: 0, right: 0, bottom: 0, left: 0 };
}
