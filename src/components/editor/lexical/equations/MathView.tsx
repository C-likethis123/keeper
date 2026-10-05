import "@/components/shared/shared.css";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import React, { useEffect, useRef, useState } from "react";

interface MathViewProps {
	expression: string;
	displayMode?: boolean;
	onError?: (error: string) => void;
	style?: object;
}

export function MathView({
	expression,
	displayMode = false,
	onError,
	style,
}: MathViewProps) {
	const theme = useExtendedTheme();
	const textColor = theme.colors.text;
	const styles = useStyles(createStyles);
	const [html, setHtml] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const onErrorRef = useRef(onError);
	onErrorRef.current = onError;

	useEffect(() => {
		if (!expression.trim()) {
			setHtml(null);
			setError(null);
			return;
		}
		let isCancelled = false;
		void import("katex")
			.then((katexModule) => {
				if (isCancelled) return;
				try {
					const rendered = katexModule.default.renderToString(
						expression.trim(),
						{
							displayMode,
							throwOnError: false,
							output: "html",
						},
					);
					setHtml(`<span style="color:${textColor}">${rendered}</span>`);
					setError(null);
				} catch {
					setError("Invalid LaTeX");
					setHtml(null);
					onErrorRef.current?.("Invalid LaTeX");
				}
			})
			.catch((e) => {
				const msg = e instanceof Error ? e.message : "Invalid LaTeX";
				if (!isCancelled) {
					setError(msg);
					setHtml(null);
				}
				onErrorRef.current?.(msg);
			});
		return () => {
			isCancelled = true;
		};
	}, [expression, displayMode, textColor]);

	if (!expression.trim()) {
		return (
			<div
				className="keeper-layout"
				style={{
					...styles.container,
					...(displayMode
						? { width: "100%", minHeight: 60 }
						: { alignSelf: "flex-start", minHeight: 24 }),
					...style,
				}}
			>
				<span
					className="keeper-copy"
					style={{ ...styles.fallback, ...styles.fallbackText }}
				>
					{expression || " "}
				</span>
			</div>
		);
	}

	if (error) {
		return (
			<div
				className="keeper-layout"
				style={{
					...styles.container,
					...(displayMode
						? { width: "100%", minHeight: 60 }
						: { alignSelf: "flex-start", minHeight: 24 }),
					...style,
				}}
			>
				<span
					className="keeper-copy"
					style={{ ...styles.fallback, ...styles.fallbackError }}
				>
					{expression}
				</span>
			</div>
		);
	}
	return React.createElement(displayMode ? "div" : "span", {
		style: {
			...(displayMode
				? { width: "100%" }
				: { display: "inline-block", verticalAlign: "middle" }),
			alignItems: "center",
			justifyContent: "center",
			minHeight: displayMode ? 60 : 24,
			backgroundColor: "transparent",
			color: textColor,
		},
		// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output, not user input
		dangerouslySetInnerHTML: { __html: html ?? "" },
	});
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return {
		container: {
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: "transparent",
		},
		fallback: { fontSize: 16, fontFamily: "monospace" },
		fallbackText: { color: theme.colors.text },
		fallbackError: { color: theme.colors.error },
	} satisfies Record<string, React.CSSProperties>;
}
