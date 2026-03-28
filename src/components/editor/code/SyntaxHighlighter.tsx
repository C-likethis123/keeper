import React from "react";
import {
	type ColorValue,
	Platform,
	ScrollView,
	Text,
	type TextStyle,
	View,
} from "react-native";
import Highlighter, {
	type SyntaxHighlighterProps as HighlighterProps,
} from "react-syntax-highlighter/dist/esm/light";
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
Highlighter.registerLanguage("yaml", langYaml);

type Node = {
	children?: Node[];
	properties?: {
		className: string[];
	};
	tagName?: string;
	type: string;
	value?: string;
};

type StyleSheet = {
	[key: string]: TextStyle & {
		background?: string;
	};
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

type SyntaxHighlighterProps = HighlighterProps & {
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

const SyntaxHighlighter = (props: PropsWithForwardRef): JSX.Element => {
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

	// Only when line numbers are showing
	const lineNumbersPadding = showLineNumbers ? 1.75 * fontSize : undefined;
	const lineNumbersFontSize = 0.7 * fontSize;

	// Prevents the last line from clipping when scrolling
	highlighterProps.children += "\n\n";

	const cleanStyle = (style: TextStyle) => {
		const clean: TextStyle = {
			...style,
			display: undefined,
		};
		return clean;
	};

	const stylesheet: StyleSheet = Object.fromEntries(
		Object.entries(syntaxStyle as StyleSheet).map(([className, style]) => [
			className,
			cleanStyle(style),
		]),
	);

	const renderLineNumbersBackground = () => (
		<View
			style={{
				position: "absolute",
				top: -padding,
				left: 0,
				bottom: 0,
				width: lineNumbersPadding ? lineNumbersPadding - 5 : 0,
				backgroundColor: lineNumbersBackgroundColor,
			}}
		/>
	);

	const renderNode = (nodes: Node[], key = "0") =>
		nodes.reduce<React.ReactNode[]>((acc, node, index) => {
			if (node.children) {
				const textElement = (
					<Text
						// biome-ignore lint/suspicious/noArrayIndexKey: syntax tree order is stable
						key={`${key}.${index}`}
						style={[
							{
								color: highlighterColor || stylesheet.hljs.color,
							},
							...(node.properties?.className || []).map((c) => stylesheet[c]),
							{
								lineHeight: highlighterLineHeight,
								fontFamily,
								fontSize,
								paddingLeft: lineNumbersPadding ?? padding,
							},
						]}
					>
						{renderNode(node.children, `${key}.${index}`)}
					</Text>
				);

				const lineNumberElement =
					key !== "0" || index >= nodes.length - 2 ? undefined : (
						<Text
							// biome-ignore lint/suspicious/noArrayIndexKey: syntax tree order is stable
							key={`$line.${index}`}
							style={{
								position: "absolute",
								top: 5,
								bottom: 0,
								paddingHorizontal: nodes.length - 2 < 100 ? 5 : 0,
								textAlign: "center",
								color: lineNumbersColor,
								fontFamily,
								fontSize: lineNumbersFontSize,
								width: lineNumbersPadding ? lineNumbersPadding - 5 : 0,
							}}
						>
							{index + 1}
						</Text>
					);

				acc.push(
					showLineNumbers && lineNumberElement ? (
						<View
							// biome-ignore lint/suspicious/noArrayIndexKey: syntax tree order is stable
							key={`view.line.${index}`}
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
						fontFamily: "monospace",
						backgroundColor: backgroundColor || stylesheet.hljs.background,
						// Prevents YGValue error
						padding: 0,
						paddingTop: padding,
						paddingRight: padding,
						paddingBottom: padding,
					},
				]}
				testID={`${testID}-scroll-view`}
				ref={forwardedRef}
				scrollEnabled={scrollEnabled}
			>
				{showLineNumbers && renderLineNumbersBackground()}
				{renderNode(rows)}
			</ScrollView>
		);
	};

	return (
		<Highlighter
			{...highlighterProps}
			customStyle={{
				padding: 0,
			}}
			CodeTag={View}
			PreTag={View}
			renderer={nativeRenderer}
			testID={testID}
			style={stylesheet}
		/>
	);
};

const SyntaxHighlighterWithForwardRef = React.forwardRef<
	ScrollView,
	SyntaxHighlighterProps
>((props, ref) => <SyntaxHighlighter {...props} forwardedRef={ref} />);

export default SyntaxHighlighterWithForwardRef;
