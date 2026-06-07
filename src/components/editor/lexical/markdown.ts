import {
	$convertFromMarkdownString,
	$convertToMarkdownString,
	CHECK_LIST,
	TRANSFORMERS,
	type ElementTransformer,
	type MultilineElementTransformer,
	type TextMatchTransformer,
} from "@lexical/markdown";
import { $createTextNode } from "lexical";
import {
	$createDetailsContentNode,
	$createDetailsNode,
	$createDetailsSummaryNode,
	$isDetailsContentNode,
	$isDetailsNode,
	$isDetailsSummaryNode,
	DetailsContentNode,
	DetailsNode,
	DetailsSummaryNode,
} from "./DetailsNode";
import { $createImageNode, $isImageNode, ImageNode } from "./ImageNode";
import {
	$createEquationNode,
	$isEquationNode,
	EquationNode,
} from "./equations/EquationNode";
import { WIKI_LINK } from "./wikilinks/WikiLinkMarkdownTransformer";

export const IMAGE: ElementTransformer = {
	dependencies: [ImageNode],
	export: (node) => {
		if (!$isImageNode(node)) {
			return null;
		}

		return `![${node.getAltText()}](${node.getSrc()})`;
	},
	regExp: /^!\[([^\]\n]*)\]\(([^)\n]+)\)$/,
	replace: (parentNode, _children, match) => {
		const [, altText = "", src = ""] = match;
		if (!src.trim()) {
			return false;
		}

		parentNode.replace($createImageNode(src.trim(), altText));
	},
	type: "element",
};

export const BLOCK_EQUATION: ElementTransformer = {
	dependencies: [EquationNode],
	export: (node) => {
		if (!$isEquationNode(node) || node.isInline()) {
			return null;
		}

		return `$$${node.getEquation()}$$`;
	},
	regExp: /^\$\$([^$\n]+)\$\$$/,
	replace: (parentNode, _children, match) => {
		const equation = match[1]?.trim();
		if (!equation) {
			return false;
		}

		parentNode.replace($createEquationNode(equation, false));
	},
	type: "element",
};

export const DETAILS: MultilineElementTransformer = {
	dependencies: [DetailsContentNode, DetailsNode, DetailsSummaryNode],
	export: (node) => {
		if (!$isDetailsNode(node)) {
			return null;
		}

		const children = node.getChildren();
		const summaryNode = children.find($isDetailsSummaryNode);
		const contentNode = children.find($isDetailsContentNode);
		const content = contentNode
			? $convertToMarkdownString(KEEPER_MARKDOWN_TRANSFORMERS, contentNode)
			: children
					.filter((child) => !$isDetailsSummaryNode(child))
					.map((child) => child.getTextContent())
					.join("\n\n")
					.trim();

		return [
			"<details>",
			`<summary>${summaryNode?.getTextContent() ?? "Title"}</summary>`,
			"",
			content,
			"",
			"</details>",
		].join("\n");
	},
	regExpEnd: /^<\/details>$/,
	regExpStart: /^<details>$/,
	replace: (rootNode, _children, _startMatch, _endMatch, linesInBetween) => {
		const normalizedLines = [...(linesInBetween ?? [])];
		while (normalizedLines[0]?.trim() === "") {
			normalizedLines.shift();
		}

		const summaryMatch = normalizedLines[0]?.match(/^<summary>(.+)<\/summary>$/);
		const title = summaryMatch?.[1]?.trim();
		if (!title) {
			return false;
		}

		const detailsNode = $createDetailsNode();
		const summaryNode = $createDetailsSummaryNode();
		const contentNode = $createDetailsContentNode();
		summaryNode.append($createTextNode(title));
		$convertFromMarkdownString(
			normalizedLines.slice(1).join("\n").trim() || "Content",
			KEEPER_MARKDOWN_TRANSFORMERS,
			contentNode,
		);
		detailsNode.append(summaryNode, contentNode);
		rootNode.append(detailsNode);
	},
	type: "multiline-element",
};

export const INLINE_EQUATION: TextMatchTransformer = {
	dependencies: [EquationNode],
	export: (node) => {
		if (!$isEquationNode(node) || !node.isInline()) {
			return null;
		}

		return `$${node.getEquation()}$`;
	},
	importRegExp: /(?<!\$)\$([^$\n]+)\$(?!\$)/,
	regExp: /(?<!\$)\$([^$\n]+)\$(?!\$)$/,
	replace: (textNode, match) => {
		const equation = match[1]?.trim();
		if (!equation) {
			return;
		}

		textNode.replace($createEquationNode(equation, true));
	},
	trigger: "$",
	type: "text-match",
};

export const KEEPER_MARKDOWN_TRANSFORMERS = [
	DETAILS,
	IMAGE,
	BLOCK_EQUATION,
	INLINE_EQUATION,
	WIKI_LINK,
	CHECK_LIST,
	...TRANSFORMERS,
];

export function importMarkdownToLexical(markdown: string) {
	$convertFromMarkdownString(markdown, KEEPER_MARKDOWN_TRANSFORMERS);
}

export function exportLexicalToMarkdown(): string {
	return $convertToMarkdownString(KEEPER_MARKDOWN_TRANSFORMERS);
}
