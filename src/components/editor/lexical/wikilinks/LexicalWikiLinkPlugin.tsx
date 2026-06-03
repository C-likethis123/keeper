import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import React, { useEffect } from "react";
import { parseWikiLinkUrl } from "./wikiLinkUrl";

interface LexicalWikiLinkPluginProps {
	onOpenWikiLink?: (title: string) => void | Promise<void>;
}

function findWikiLinkTitle(target: EventTarget | null): string | null {
	if (!(target instanceof Element)) {
		return null;
	}

	const anchor = target.closest("a");
	const href = anchor?.getAttribute("href");
	return href ? parseWikiLinkUrl(href) : null;
}

export function LexicalWikiLinkPlugin({
	onOpenWikiLink,
}: LexicalWikiLinkPluginProps) {
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		if (!onOpenWikiLink) {
			return;
		}

		const root = editor.getRootElement();
		if (!root) {
			return;
		}

		const handleClick = (event: MouseEvent) => {
			const title = findWikiLinkTitle(event.target);
			if (!title) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			void onOpenWikiLink(title);
		};

		root.addEventListener("click", handleClick);

		return () => {
			root.removeEventListener("click", handleClick);
		};
	}, [editor, onOpenWikiLink]);

	return null;
}
