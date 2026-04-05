import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

const LazyMathJaxSvg = React.lazy(() =>
	import("react-native-mathjax-html-to-svg").then((module) => ({
		default: module.MathJaxSvg,
	})),
);

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
		if (Platform.OS !== "web") return;
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
			<View style={[styles.container, displayMode ? { width: "100%", minHeight: 60 } : { alignSelf: "flex-start", minHeight: 24 }, style]}>
				<Text style={[styles.fallback, styles.fallbackText]}>
					{expression || " "}
				</Text>
			</View>
		);
	}

	if (Platform.OS === "web") {
		if (error) {
			return (
				<View style={[styles.container, displayMode ? { width: "100%", minHeight: 60 } : { alignSelf: "flex-start", minHeight: 24 }, style]}>
					<Text style={[styles.fallback, styles.fallbackError]}>
						{expression}
					</Text>
				</View>
			);
		}
		return React.createElement("div", {
			style: {
				width: "100%",
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

	const mathJaxInput = displayMode
		? `$$${expression}$$`
		: `\\(${expression}\\)`;
	const fontSize = displayMode ? 18 : 14;

	return (
		<View style={[styles.container, style]}>
			<React.Suspense
				fallback={
					<Text style={[styles.fallback, styles.fallbackText]}>
						{expression}
					</Text>
				}
			>
				<LazyMathJaxSvg
					fontSize={fontSize}
					color={textColor}
					style={styles.mathJaxContainer}
				>
					{mathJaxInput}
				</LazyMathJaxSvg>
			</React.Suspense>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: "transparent",
		},
		mathJaxContainer: {
			flexDirection: "row",
			flexWrap: "wrap",
			alignItems: "center",
			flexShrink: 1,
		},
		fallback: {
			fontSize: 16,
			fontFamily: "monospace",
		},
		fallbackText: {
			color: theme.colors.text,
		},
		fallbackError: {
			color: theme.colors.error,
		},
	});
}
