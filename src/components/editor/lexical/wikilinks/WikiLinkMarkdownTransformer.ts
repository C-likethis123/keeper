import {
	$createLinkNode,
	$isAutoLinkNode,
	$isLinkNode,
	LinkNode,
} from "@lexical/link";
import type { TextMatchTransformer } from "@lexical/markdown";
import { $createTextNode } from "lexical";
import { createWikiLinkUrl, parseWikiLinkUrl } from "./wikiLinkUrl";

export const WIKI_LINK: TextMatchTransformer = {
	dependencies: [LinkNode],
	export: (node, exportChildren) => {
		if (!$isLinkNode(node) || $isAutoLinkNode(node)) {
			return null;
		}

		const title = parseWikiLinkUrl(node.getURL());
		if (!title) {
			return null;
		}

		return `[[${exportChildren(node)}]]`;
	},
	importRegExp: /\[\[([^\]\n]+?)\]\]/,
	regExp: /\[\[([^\]\n]+?)\]\]$/,
	replace: (textNode, match) => {
		const title = match[1]?.trim();
		if (!title) {
			return;
		}

		const linkNode = $createLinkNode(createWikiLinkUrl(title));
		const titleNode = $createTextNode(title);
		titleNode.setFormat(textNode.getFormat());
		linkNode.append(titleNode);
		textNode.replace(linkNode);
		return titleNode;
	},
	trigger: "]",
	type: "text-match",
};
