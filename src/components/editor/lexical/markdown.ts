import {
	$convertFromMarkdownString,
	$convertToMarkdownString,
	CHECK_LIST,
	TRANSFORMERS,
	type ElementTransformer,
	type TextMatchTransformer,
} from "@lexical/markdown";
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
