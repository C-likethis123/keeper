import React, { type CSSProperties } from "react";
import {
	type ColorValue,
	Platform,
	ScrollView,
	Text,
	type TextStyle,
	View,
	type ViewStyle,
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

type RendererNode = {
	type: string;
	value?: string | number;
	properties?: {
		className: string[];
	};
	children?: RendererNode[];
};

type SyntaxStyleEntry = CSSProperties & {
	display?: unknown;
};

type HighlighterRenderer = NonNullable<
	React.ComponentProps<typeof Highlighter>["renderer"]
>;
type HighlighterRendererParams = Parameters<HighlighterRenderer>[0];

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

type SyntaxHighlighterProps = React.ComponentProps<typeof Highlighter> & {
	/**
	 * Code to display.
	 */
	children: string;

	/**
	 * Syntax highlighting style.
	 * @See https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_STYLES_HLJS.MD
	 */
	syntaxStyle?: Record<string, CSSProperties>;

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

	const cleanStyle = (style: SyntaxStyleEntry) => {
		const { display: _display, ...rest } = style;
		return rest;
	};

	const stylesheet = Object.fromEntries(
		Object.entries(syntaxStyle).map(([key, value]) => [key, cleanStyle(value)]),
	) as Record<string, CSSProperties>;

	const renderNode = (nodes: RendererNode[], key = "0"): React.ReactNode[] => {
		const renderedNodes: React.ReactNode[] = [];

		for (const node of nodes) {
			const nodeKey = `${key}-${node.type}-${node.value ?? "group"}-${renderedNodes.length}`;
			if (node.children) {
				const nodeStyle: TextStyle = {};
				for (const className of node.properties?.className ?? []) {
					Object.assign(nodeStyle, stylesheet[className] as TextStyle);
				}

				const textElement = (
					<Text
						key={`${nodeKey}-text`}
						style={[
							{
								fontFamily,
								fontSize,
								color: highlighterColor || stylesheet.hljs.color,
							},
							nodeStyle,
						]}
					>
						{renderNode(node.children, nodeKey)}
					</Text>
				);

				const lineNumberElement = showLineNumbers ? (
					<View
						key={`${nodeKey}-line-number-container`}
						style={{
							backgroundColor: lineNumbersBackgroundColor,
							paddingRight: 10,
							paddingLeft: 10,
						}}
					>
						<Text
							key={`${nodeKey}-line-number`}
							style={{
								fontFamily,
								fontSize,
								color: lineNumbersColor,
							}}
						>
							{Number.parseInt(key, 10) + 1}
						</Text>
					</View>
				) : null;

				renderedNodes.push(
					showLineNumbers ? (
						<View
							key={`${nodeKey}-row`}
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

			if (node.value !== undefined) {
				let textValue = String(node.value);
				// To prevent an empty line after each string
				textValue = textValue.replace("\n", "");
				// To render blank lines at an equal font height
				textValue = textValue.length ? textValue : " ";
				renderedNodes.push(textValue);
			}
		}

		return renderedNodes;
	};

	const baseStyle = stylesheet.hljs;
	const syntaxBackground =
		backgroundColor ??
		(typeof baseStyle?.backgroundColor === "string"
			? baseStyle.backgroundColor
			: typeof baseStyle?.background === "string"
				? baseStyle.background
				: undefined);

	const scrollStyle: ViewStyle = {
		width: "100%",
		height: "100%",
		backgroundColor: syntaxBackground as ColorValue,
		// Prevents YGValue error
		padding: 0,
		paddingTop: padding,
		paddingRight: padding,
		paddingBottom: padding,
	};

	const nativeRenderer = ({ rows }: HighlighterRendererParams) => {
		return (
			<ScrollView
				style={scrollStyle}
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
			style={syntaxStyle as Record<string, CSSProperties>}
			horizontal={false}
			renderer={nativeRenderer}
		/>
	);
};

export default React.forwardRef<ScrollView, SyntaxHighlighterProps>(
	(props, ref) => (
		<SyntaxHighlighter
			{...(props as SyntaxHighlighterProps)}
			forwardedRef={ref}
		/>
	),
);
