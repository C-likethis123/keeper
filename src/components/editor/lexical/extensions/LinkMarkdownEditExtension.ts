import { $isAutoLinkNode, $isLinkNode, type LinkNode } from "@lexical/link";
import { LINK } from "@lexical/markdown";
import {
	$createTextNode,
	$getNodeByKey,
	$getSelection,
	$isRangeSelection,
	$isTextNode,
	type LexicalNode,
	type NodeKey,
	type TextNode,
	COMMAND_PRIORITY_LOW,
	defineExtension,
	SELECTION_CHANGE_COMMAND,
} from "lexical";
import { parseWikiLinkUrl } from "../wikilinks/wikiLinkUrl";
import { WIKI_LINK } from "../wikilinks/WikiLinkMarkdownTransformer";

function findLink(node: LexicalNode): LinkNode | null {
	let current: LexicalNode | null = node;
	while (current) {
		if ($isLinkNode(current)) {
			return current;
		}
		current = current.getParent();
	}
	return null;
}

function getOffsetWithinLink(link: LinkNode, anchorNode: LexicalNode, offset: number) {
	let linkOffset = 0;
	for (const textNode of link.getAllTextNodes()) {
		if (textNode.is(anchorNode)) {
			return linkOffset + offset;
		}
		linkOffset += textNode.getTextContentSize();
	}
	return linkOffset;
}

function serializeLink(link: LinkNode) {
	const text = link.getTextContent();
	if (parseWikiLinkUrl(link.getURL())) {
		return { markdown: `[[${text}]]`, labelOffset: 2 };
	}

	const title = link.getTitle()?.replace(/([\\"])/g, "\\$1");
	return {
		markdown: title
			? `[${text}](${link.getURL()} "${title}")`
			: `[${text}](${link.getURL()})`,
		labelOffset: 1,
	};
}

function getWholeMatch(transformer: typeof LINK | typeof WIKI_LINK, markdown: string) {
	const match = transformer.importRegExp?.exec(markdown);
	return match?.index === 0 && match[0] === markdown ? match : null;
}

function collapseMarkdownNode(node: TextNode) {
	const markdown = node.getTextContent();
	const wikiMatch = getWholeMatch(WIKI_LINK, markdown);
	if (wikiMatch) {
		WIKI_LINK.replace?.(node, wikiMatch);
		return;
	}

	const linkMatch = getWholeMatch(LINK, markdown);
	if (linkMatch) {
		LINK.replace?.(node, linkMatch);
		return;
	}

	node.toggleUnmergeable();
}

export const LinkMarkdownEditExtension = defineExtension({
	name: "keeper/LinkMarkdownEdit",
	register(editor) {
		let expandedNodeKey: NodeKey | null = null;

		return editor.registerCommand(
			SELECTION_CHANGE_COMMAND,
			() => {
				const selection = $getSelection();
				if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
					return false;
				}

				const anchorNode = selection.anchor.getNode();
				if (expandedNodeKey) {
					const expandedNode = $getNodeByKey(expandedNodeKey);
					if (expandedNode?.is(anchorNode)) {
						return false;
					}
					if ($isTextNode(expandedNode)) {
						collapseMarkdownNode(expandedNode);
					}
					expandedNodeKey = null;
				}

				const link = findLink(anchorNode);
				if (!link || $isAutoLinkNode(link)) {
					return false;
				}

				const offset = getOffsetWithinLink(
					link,
					anchorNode,
					selection.anchor.offset,
				);
				const { markdown, labelOffset } = serializeLink(link);
				const markdownNode = $createTextNode(markdown).toggleUnmergeable();
				link.replace(markdownNode);
				const markdownOffset = Math.min(labelOffset + offset, markdown.length);
				markdownNode.select(markdownOffset, markdownOffset);
				expandedNodeKey = markdownNode.getKey();
				return false;
			},
			COMMAND_PRIORITY_LOW,
		);
	},
});
