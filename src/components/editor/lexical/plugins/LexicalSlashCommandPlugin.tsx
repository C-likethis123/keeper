import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
	$createParagraphNode,
	$createTextNode,
	$getSelection,
	$insertNodes,
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
	SlashCommandOverlay,
	type SlashCommandItem,
} from "@/components/editor/slash-commands/SlashCommandOverlay";
import { findSlashCommandTriggerStart } from "@/components/editor/slash-commands/SlashCommandTrigger";
import {
	$createDetailsContentNode,
	$createDetailsNode,
	$createDetailsSummaryNode,
} from "../DetailsNode";

const COMMANDS: SlashCommandItem[] = [
	{
		id: "insert-collapsible",
		title: "Collapsible",
		description: "Insert a collapsible details section.",
		keywords: ["collapse", "collapsible", "details", "toggle", "summary"],
	},
	{
		id: "insert-template",
		title: "Insert template",
		description: "Open the template picker and replace the note body.",
		keywords: ["template", "insert", "snippet"],
	},
];

interface SlashCommandSession {
	query: string;
	selectedIndex: number;
}

interface OverlayPosition {
	left: number;
	top: number;
}

interface LexicalSlashCommandPluginProps {
	onInsertTemplateCommand?: () => void | Promise<void>;
}

function getSlashQuery(): string | null {
	const selection = $getSelection();
	if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
		return null;
	}

	const anchor = selection.anchor;
	const node = anchor.getNode();
	if (!$isTextNode(node)) {
		return null;
	}

	const text = node.getTextContent();
	const slashStart = findSlashCommandTriggerStart(text, anchor.offset);
	if (slashStart === null) {
		return null;
	}

	return text.slice(slashStart + 1, anchor.offset);
}

function getOverlayPosition(editor: LexicalEditor): OverlayPosition | null {
	const rootElement = editor.getRootElement();
	const shellElement = rootElement?.closest(".keeper-editor-shell");
	const selection = window.getSelection();
	if (!rootElement || !shellElement || !selection || selection.rangeCount === 0) {
		return null;
	}

	const range = selection.getRangeAt(0);
	const rangeRect =
		range.getClientRects()[0] ??
		(range.getBoundingClientRect().width || range.getBoundingClientRect().height
			? range.getBoundingClientRect()
			: null);
	if (!rangeRect) {
		return null;
	}

	const shellRect = shellElement.getBoundingClientRect();
	const maxLeft = Math.max(18, shellRect.width - 438);
	return {
		left: Math.min(Math.max(18, rangeRect.left - shellRect.left), maxLeft),
		top: rangeRect.bottom - shellRect.top + 8,
	};
}

function removeSlashToken(editor: LexicalEditor) {
	editor.update(
		() => {
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
			const slashStart = findSlashCommandTriggerStart(text, anchor.offset);
			if (slashStart === null) {
				return;
			}

			node.setTextContent(
				`${text.slice(0, slashStart)}${text.slice(anchor.offset)}`,
			);
			node.select(slashStart, slashStart);
		},
		{ discrete: true },
	);
}

function insertCollapsibleBlock(editor: LexicalEditor) {
	editor.update(
		() => {
			const detailsNode = $createDetailsNode();
			const summaryNode = $createDetailsSummaryNode();
			const contentNode = $createDetailsContentNode();
			const paragraphNode = $createParagraphNode();

			summaryNode.append($createTextNode("Title"));
			paragraphNode.append($createTextNode("Content"));
			contentNode.append(paragraphNode);
			detailsNode.append(summaryNode, contentNode);

			$insertNodes([detailsNode]);
			paragraphNode.selectEnd();
		},
		{ discrete: true },
	);
}

export function LexicalSlashCommandPlugin({
	onInsertTemplateCommand,
}: LexicalSlashCommandPluginProps) {
	const [editor] = useLexicalComposerContext();
	const [session, setSession] = useState<SlashCommandSession | null>(null);
	const [position, setPosition] = useState<OverlayPosition | null>(null);

	const results = useMemo(() => {
		const normalizedQuery = session?.query.trim().toLowerCase() ?? "";
		if (normalizedQuery.length === 0) {
			return COMMANDS;
		}

		return COMMANDS.filter((item) => {
			const haystacks = [item.title, item.description, ...item.keywords];
			return haystacks.some((value) =>
				value.toLowerCase().includes(normalizedQuery),
			);
		});
	}, [session?.query]);

	useEffect(() => {
		return editor.registerUpdateListener(({ editorState }) => {
			editorState.read(() => {
				const query = getSlashQuery();
				setSession((current) => {
					if (query === null) {
						setPosition(null);
						return current === null ? current : null;
					}
					setPosition(getOverlayPosition(editor));
					if (current?.query === query) {
						return current;
					}
					return { query, selectedIndex: 0 };
				});
			});
		});
	}, [editor]);

	const cancelSession = useCallback(() => {
		removeSlashToken(editor);
		setSession(null);
		setPosition(null);
	}, [editor]);

	const selectItem = useCallback(
		(item: SlashCommandItem) => {
			removeSlashToken(editor);
			setSession(null);
			setPosition(null);
			if (item.id === "insert-collapsible") {
				insertCollapsibleBlock(editor);
				return;
			}
			if (item.id === "insert-template") {
				void onInsertTemplateCommand?.();
			}
		},
		[editor, onInsertTemplateCommand],
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
				if (!session) {
					return false;
				}
				event?.preventDefault();
				const selected = results[session.selectedIndex];
				if (selected) {
					selectItem(selected);
				}
				return true;
			},
			COMMAND_PRIORITY_LOW,
		);
	}, [editor, results, selectItem, session]);

	if (!session) {
		return null;
	}

	return (
		<View
			style={{
				position: "absolute",
				top: position?.top ?? 64,
				left: position?.left ?? 18,
				right: 18,
				maxWidth: 420,
				zIndex: 100,
			}}
		>
			<SlashCommandOverlay
				results={results}
				selectedIndex={Math.min(session.selectedIndex, results.length - 1)}
				onSelect={selectItem}
			/>
		</View>
	);
}
