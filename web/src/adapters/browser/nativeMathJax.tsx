import type { ReactNode } from "react";

/** Native-only fallback is never rendered in browser; keep dynamic import Vite-safe. */
export function MathJaxSvg({ children }: { children?: ReactNode }) {
	return <span>{children}</span>;
}
