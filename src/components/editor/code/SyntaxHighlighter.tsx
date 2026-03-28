import React from "react";
import {
	type ColorValue,
	Platform,
	ScrollView,
	Text,
	type TextStyle,
	View,
} from "react-native";
import Highlighter from "react-syntax-highlighter/dist/esm/light";
import atomOneDark from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";

// Register only the languages used in LanguageRegistry — keeps the bundle lean.
import langBash from "react-syntax-highlighter/dist/esm/languages/hljs/bash";
import langCpp from "react-syntax-highlighter/dist/esm/languages/hljs/cpp";
import langCs from "react-syntax-highlighter/dist/esm/languages/hljs/csharp";
import langCss from "react-syntax-highlighter/dist/esm/languages/hljs/css";
import langDart from "react-syntax-highlighter/dist/esm/languages/hljs/dart";
import langGo from "react-syntax-highlighter/dist/esm/languages/hljs/go";
import langJava from "react-syntax-highlighter/dist/esm/languages/hljs/java";
import langJs from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import langJson from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import langKotlin from "react-syntax-highlighter/dist/esm/languages/hljs/kotlin";
import langPlaintext from "react-syntax-highlighter/dist/esm/languages/hljs/plaintext";
import langPython from "react-syntax-highlighter/dist/esm/languages/hljs/python";
import langRust from "react-syntax-highlighter/dist/esm/languages/hljs/rust";
import langShell from "react-syntax-highlighter/dist/esm/languages/hljs/shell";
import langSql from "react-syntax-highlighter/dist/esm/languages/hljs/sql";
import langSwift from "react-syntax-highlighter/dist/esm/languages/hljs/swift";
import langTs from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import langXml from "react-syntax-highlighter/dist/esm/languages/hljs/xml";
import langYaml from "react-syntax-highlighter/dist/esm/languages/hljs/yaml";

Highlighter.registerLanguage("bash", langBash);
Highlighter.registerLanguage("cpp", langCpp);
Highlighter.registerLanguage("csharp", langCs);
Highlighter.registerLanguage("css", langCss);
Highlighter.registerLanguage("dart", langDart);
Highlighter.registerLanguage("go", langGo);
Highlighter.registerLanguage("html", langXml);
Highlighter.registerLanguage("java", langJava);
Highlighter.registerLanguage("javascript", langJs);
Highlighter.registerLanguage("json", langJson);
Highlighter.registerLanguage("kotlin", langKotlin);
Highlighter.registerLanguage("plaintext", langPlaintext);
Highlighter.registerLanguage("python", langPython);
Highlighter.registerLanguage("rust", langRust);
Highlighter.registerLanguage("shell", langShell);
Highlighter.registerLanguage("sql", langSql);
Highlighter.registerLanguage("swift", langSwift);
Highlighter.registerLanguage("typescript", langTs);
Highlighter.registerLanguage("xml", langXml);
Highlighter.registerLanguage("yaml", langYaml);

type Node = {
	type: string;
	value?: string;
	properties?: {
		className: string[];
	};
	children?: Node[];
};

type StyleSheet = {
	[key: string]: TextStyle;
};

type RendererParams = {
	rows: Node[];
	stylesheet: StyleSheet;
};

type SyntaxHighlighterStyleType = {
	/**
	 * Default is Menlo-Regular (iOS) and Monospace (Android).
	 */
	fontFamily?: string;

	/**
	 * Default is 16.
	 */
	fontSize?: number;

	/**
	 * Override the syntax style background.
	 */
	backgroundColor?: ColorValue;

	/**
	 * Default is 16.
	 */
	padding?: number;

	/**
	 * Text color of the line numbers.
	 */
	lineNumbersColor?: ColorValue;

	/**
	 * Background color of the line numbers.
	 */
	lineNumbersBackgroundColor?: ColorValue;

	/**
	 * Use this property to align the syntax highlighter text with the text input.
	 */
	highlighterLineHeight?: number;

	/**
	 * Use this property to help you align the syntax highlighter text with the text input.
	 * Do not use in production.
	 */
	highlighterColor?: ColorValue;
};

type SyntaxHighlighterProps = any & {
	/**
	 * Code to display.
	 */
	children: string;

	/**
	 * Syntax highlighting style.
	 * @See https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_STYLES_HLJS.MD
	 */
	syntaxStyle?: Record<string, React.CSSProperties>;

	/**
	 * Extra styling options for the syntax highlighter.
	 */
	addedStyle?: SyntaxHighlighterStyleType;

	/**
	 * Whether to allow scrolling on the syntax highlighter.
	 */
	scrollEnabled?: boolean;

	/**
	 * Test ID used for testing.
	 */
	testID?: string;
};

type PropsWithForwardRef = SyntaxHighlighterProps & {
	forwardedRef: React.Ref<ScrollView>;
};

const SyntaxHighlighter = (props: PropsWithForwardRef): React.JSX.Element => {
	const {
		syntaxStyle = atomOneDark,
		addedStyle,
		scrollEnabled,
		showLineNumbers = false,
		forwardedRef,
		testID,
		...highlighterProps
	} = props;

	// Default values
	const {
		fontFamily = Platform.OS === "ios" ? "Menlo-Regular" : "monospace",
		fontSize = 16,
		backgroundColor = undefined,
		padding = 16,
		lineNumbersColor = "rgba(127, 127, 127, 0.9)",
		lineNumbersBackgroundColor = undefined,
		highlighterLineHeight = undefined,
		highlighterColor = undefined,
	} = addedStyle || {};

	const cleanStyle = (style: TextStyle) => {
		const {
			display: _display,
			...rest
		} = style as any;
		return rest;
	};

	const stylesheet = Object.fromEntries(
		Object.entries(syntaxStyle).map(([key, value]) => [
			key,
			cleanStyle(value as any),
		]),
	);

	const renderNode = (nodes: Node[], key = "0"): React.ReactNode[] =>
		nodes.reduce<React.ReactNode[]>((acc, node, index) => {
			if (node.children) {
				const nodeStyle = node.properties?.className.reduce(
					(merged, className) => ({
						...merged,
						...stylesheet[className],
					}),
					{} as TextStyle,
				);

				const textElement = (
					<Text
						key={`${key}-${index}-text`}
						style={[
							{
								fontFamily,
								fontSize,
								color: highlighterColor || stylesheet.hljs.color,
							},
							nodeStyle,
						]}
					>
						{renderNode(node.children, `${key}-${index}`)}
					</Text>
				);

				const lineNumberElement = showLineNumbers ? (
					<View
						key={`${key}-${index}-line-number-container`}
						style={{
							backgroundColor: lineNumbersBackgroundColor,
							paddingRight: 10,
							paddingLeft: 10,
						}}
					>
						<Text
							key={`${key}-${index}-line-number`}
							style={{
								fontFamily,
								fontSize,
								color: lineNumbersColor,
							}}
						>
							{parseInt(key, 10) + 1}
						</Text>
					</View>
				) : null;

				acc.push(
					showLineNumbers ? (
						<View
							key={`${key}-${index}-row`}
							style={{
								flexDirection: "row",
							}}
						>
							{lineNumberElement}
							{textElement}
						</View>
					) : (
						textElement
					),
				);
			}

			if (node.value) {
				// To prevent an empty line after each string
				node.value = node.value.replace("\n", "");
				// To render blank lines at an equal font height
				node.value = node.value.length ? node.value : " ";
				acc.push(node.value);
			}

			return acc;
		}, []);

	const nativeRenderer = ({ rows }: RendererParams) => {
		return (
			<ScrollView
				style={[
					stylesheet.hljs,
					{
						width: "100%",
						height: "100%",
						backgroundColor: (backgroundColor || stylesheet.hljs.background) as ColorValue,
						// Prevents YGValue error
						padding: 0,
						paddingTop: padding,
						paddingRight: padding,
						paddingBottom: padding,
					} as any,
				]}
				testID={`${testID}-scroll-view`}
				ref={forwardedRef}
				scrollEnabled={scrollEnabled}
			>
				{renderNode(rows)}
			</ScrollView>
		);
	};

	return (
		<Highlighter
			{...highlighterProps}
			key={testID}
			language={highlighterProps.language || "plaintext"}
			style={syntaxStyle}
			horizontal={false}
			renderer={nativeRenderer}
		/>
	);
};

export default React.forwardRef<ScrollView, SyntaxHighlighterProps>(
	(props, ref) => <SyntaxHighlighter {...props} forwardedRef={ref} />,
);
