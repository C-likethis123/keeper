import {
	$convertFromMarkdownString,
	$convertToMarkdownString,
	CHECK_LIST,
	TRANSFORMERS,
	type ElementTransformer,
	type MultilineElementTransformer,
	type TextMatchTransformer,
} from "@lexical/markdown";
import {
	$createParagraphNode,
	$createTextNode,
} from "lexical";
import {
	$createTableCellNode,
	$createTableNode,
	$createTableRowNode,
	$isTableCellNode,
	$isTableNode,
	$isTableRowNode,
	TableCellHeaderStates,
	TableCellNode,
	TableNode,
	TableRowNode,
} from "@lexical/table";
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

const TABLE_ROW_REG_EXP = /^\|(.+)\|\s*$/;
const TABLE_DIVIDER_REG_EXP = /^(\|\s*:?-{3,}:?\s*)+\|\s*$/;

function splitTableRow(line: string): string[] {
	return line
		.trim()
		.replace(/^\|/, "")
		.replace(/\|\s*$/, "")
		.split("|")
		.map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function escapeTableCell(value: string): string {
	return value.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

function getTableCellMarkdown(cellNode: TableCellNode): string {
	const content = $convertToMarkdownString(
		KEEPER_MARKDOWN_TRANSFORMERS,
		cellNode,
	);
	return escapeTableCell(content.replace(/\n{2,}/g, " ").replace(/\n/g, " "));
}

function createTableDivider(columnCount: number): string {
	return `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`;
}

function createTableRow(cells: string[]): TableRowNode {
	const rowNode = $createTableRowNode();
	for (const cell of cells) {
		const cellNode = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
		const paragraphNode = $createParagraphNode();
		if (cell.length > 0) {
			paragraphNode.append($createTextNode(cell));
		}
		cellNode.append(paragraphNode);
		rowNode.append(cellNode);
	}
	return rowNode;
}

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

		const imageNode = $createImageNode(src.trim(), altText);
		parentNode.replace(imageNode);
		imageNode.insertAfter($createParagraphNode());
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

export const TABLE: MultilineElementTransformer = {
	dependencies: [TableNode, TableCellNode, TableRowNode],
	export: (node) => {
		if (!$isTableNode(node)) {
			return null;
		}

		const rows = node
			.getChildren()
			.filter($isTableRowNode)
			.map((rowNode) =>
				rowNode.getChildren().filter($isTableCellNode).map(getTableCellMarkdown),
			);
		if (rows.length === 0) {
			return null;
		}

		const columnCount = Math.max(...rows.map((row) => row.length));
		const normalizedRows = rows.map((row) => [
			...row,
			...Array.from({ length: columnCount - row.length }, () => ""),
		]);
		const markdownRows = normalizedRows.map(
			(row) => `| ${row.join(" | ")} |`,
		);
		markdownRows.splice(1, 0, createTableDivider(columnCount));
		return markdownRows.join("\n");
	},
	handleImportAfterStartMatch: ({ lines, rootNode, startLineIndex }) => {
		const tableLines: string[] = [];
		for (let index = startLineIndex; index < lines.length; index += 1) {
			const line = lines[index]?.trimEnd() ?? "";
			if (!TABLE_ROW_REG_EXP.test(line) && !TABLE_DIVIDER_REG_EXP.test(line)) {
				break;
			}
			tableLines.push(line);
		}

		const rows = tableLines
			.filter((line) => !TABLE_DIVIDER_REG_EXP.test(line))
			.map(splitTableRow);
		if (rows.length === 0) {
			return null;
		}

		const columnCount = Math.max(...rows.map((row) => row.length));
		const tableNode = $createTableNode();
		for (const row of rows) {
			tableNode.append(
				createTableRow([
					...row,
					...Array.from({ length: columnCount - row.length }, () => ""),
				]),
			);
		}
		rootNode.append(tableNode);
		return [true, startLineIndex + tableLines.length - 1];
	},
	regExpStart: TABLE_ROW_REG_EXP,
	replace: (rootNode, _children, startMatch) => {
		const cells = splitTableRow(startMatch[0] ?? "");
		if (cells.length === 0) {
			return false;
		}
		rootNode.append($createTableNode().append(createTableRow(cells)));
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
	TABLE,
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
