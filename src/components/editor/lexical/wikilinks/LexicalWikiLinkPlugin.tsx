import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createLinkNode } from "@lexical/link";
import {
	$createTextNode,
	$getSelection,
	$isRangeSelection,
	$isTextNode,
	COMMAND_PRIORITY_LOW,
	KEY_ARROW_DOWN_COMMAND,
	KEY_ARROW_UP_COMMAND,
	KEY_ESCAPE_COMMAND,
	KEY_ENTER_COMMAND,
	type LexicalEditor,
} from "lexical";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
	WikiLinkOverlay,
	type WikiLinkResult,
} from "@/components/editor/wikilinks/WikiLinkOverlay";
import { findExactWikiLinkMatch } from "@/components/editor/wikilinks/wikiLinkUtils";
import { NotesIndexService } from "@/services/notes/notesIndex";
import { createWikiLinkUrl, parseWikiLinkUrl } from "./wikiLinkUrl";

interface LexicalWikiLinkPluginProps {
	onOpenWikiLink?: (title: string) => void | Promise<void>;
}

interface WikiLinkSession {
	query: string;
	selectedIndex: number;
}

const RESULT_LIMIT = 8;

function findWikiLinkTitle(target: EventTarget | null): string | null {
	if (!(target instanceof Element)) {
		return null;
	}

	const anchor = target.closest("a");
	const href = anchor?.getAttribute("href");
	return href ? parseWikiLinkUrl(href) : null;
}

function getWikiLinkQuery(): string | null {
	const selection = $getSelection();
	if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
		return null;
	}

	const anchor = selection.anchor;
	const node = anchor.getNode();
	if (!$isTextNode(node)) {
		return null;
	}

	const beforeCursor = node.getTextContent().slice(0, anchor.offset);
	const triggerStart = beforeCursor.lastIndexOf("[[");
	if (triggerStart === -1) {
		return null;
	}

	const query = beforeCursor.slice(triggerStart + 2);
	if (query.includes("]]") || query.includes("\n")) {
		return null;
	}

	return query;
}

function insertWikiLink(editor: LexicalEditor, title: string) {
	editor.update(() => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
			return;
		}

		const anchor = selection.anchor;
		const node = anchor.getNode();
		if (!$isTextNode(node)) {
			return;
		}

		const text = node.getTextContent();
		const beforeCursor = text.slice(0, anchor.offset);
		const triggerStart = beforeCursor.lastIndexOf("[[");
		if (triggerStart === -1) {
			return;
		}

		const query = beforeCursor.slice(triggerStart + 2);
		if (query.includes("]]") || query.includes("\n")) {
			return;
		}

		const beforeTrigger = text.slice(0, triggerStart);
		const afterCursor = text.slice(anchor.offset);
		const wikiLink = $createLinkNode(createWikiLinkUrl(title));
		wikiLink.append($createTextNode(title));

		node.setTextContent(beforeTrigger);
		node.insertAfter(wikiLink);

		if (afterCursor.length > 0) {
			const trailingText = $createTextNode(afterCursor);
			wikiLink.insertAfter(trailingText);
			trailingText.select(0, 0);
			return;
		}

		wikiLink.selectNext();
	});
}

export function LexicalWikiLinkPlugin({
	onOpenWikiLink,
}: LexicalWikiLinkPluginProps) {
	const [editor] = useLexicalComposerContext();
	const [session, setSession] = useState<WikiLinkSession | null>(null);
	const [results, setResults] = useState<WikiLinkResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const selectedIndex = useMemo(() => {
		if (!session || results.length === 0) {
			return 0;
		}
		return Math.min(session.selectedIndex, results.length - 1);
	}, [results.length, session]);

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

	useEffect(() => {
		return editor.registerUpdateListener(({ editorState }) => {
			editorState.read(() => {
				const query = getWikiLinkQuery();
				setSession((current) => {
					if (query === null) {
						return current === null ? current : null;
					}
					if (current?.query === query) {
						return current;
					}
					return { query, selectedIndex: 0 };
				});
			});
		});
	}, [editor]);

	useEffect(() => {
		const rawQuery = session?.query;
		if (rawQuery === undefined) {
			setResults([]);
			setIsLoading(false);
			return;
		}

		let cancelled = false;
		const query = rawQuery.trim();
		setIsLoading(true);
		NotesIndexService.listNotes(query, RESULT_LIMIT, 0)
			.then((result) => {
				if (cancelled) {
					return;
				}

				const noteResults: WikiLinkResult[] = result.items.map((item) => ({
					id: item.noteId,
					noteId: item.noteId,
					title: item.title,
					type: "existing",
				}));

				const shouldShowCreate =
					query.length > 0 && !findExactWikiLinkMatch(result.items, query);
				setResults(
					shouldShowCreate
						? [
								...noteResults,
								{
									id: `create-${query}`,
									title: query,
									type: "create",
								},
							]
						: noteResults,
				);
			})
			.catch((error) => {
				console.warn("[LexicalWikiLinkPlugin] note lookup failed:", error);
				if (!cancelled) {
					setResults(
						query.length > 0
							? [{ id: `create-${query}`, title: query, type: "create" }]
							: [],
					);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [session?.query]);

	const cancelSession = useCallback(() => {
		setSession(null);
	}, []);

	const selectResult = useCallback(
		(result: WikiLinkResult) => {
			insertWikiLink(editor, result.title);
			setSession(null);
		},
		[editor],
	);

	useEffect(() => {
		return editor.registerCommand(
			KEY_ARROW_DOWN_COMMAND,
			(event: KeyboardEvent) => {
				if (!session || results.length === 0) {
					return false;
				}
				event.preventDefault();
				setSession((current) =>
					current
						? {
								...current,
								selectedIndex: (current.selectedIndex + 1) % results.length,
							}
						: current,
				);
				return true;
			},
			COMMAND_PRIORITY_LOW,
		);
	}, [editor, results.length, session]);

	useEffect(() => {
		return editor.registerCommand(
			KEY_ARROW_UP_COMMAND,
			(event: KeyboardEvent) => {
				if (!session || results.length === 0) {
					return false;
				}
				event.preventDefault();
				setSession((current) =>
					current
						? {
								...current,
								selectedIndex:
									(current.selectedIndex - 1 + results.length) % results.length,
							}
						: current,
				);
				return true;
			},
			COMMAND_PRIORITY_LOW,
		);
	}, [editor, results.length, session]);

	useEffect(() => {
		return editor.registerCommand(
			KEY_ESCAPE_COMMAND,
			(event: KeyboardEvent) => {
				if (!session) {
					return false;
				}
				event.preventDefault();
				cancelSession();
				return true;
			},
			COMMAND_PRIORITY_LOW,
		);
	}, [cancelSession, editor, session]);

	useEffect(() => {
		return editor.registerCommand(
			KEY_ENTER_COMMAND,
			(event: KeyboardEvent | null) => {
				if (!session || results.length === 0) {
					return false;
				}
				event?.preventDefault();
				const selected = results[selectedIndex];
				if (selected) {
					selectResult(selected);
				}
				return true;
			},
			COMMAND_PRIORITY_LOW,
		);
	}, [editor, results, selectResult, selectedIndex, session]);

	if (!session) {
		return null;
	}

	return (
		<View
			style={{
				position: "absolute",
				top: 64,
				left: 18,
				right: 18,
				maxWidth: 420,
				zIndex: 20,
			}}
		>
			<WikiLinkOverlay
				results={results}
				selectedIndex={selectedIndex}
				isLoading={isLoading}
				onSelect={selectResult}
			/>
		</View>
	);
}
