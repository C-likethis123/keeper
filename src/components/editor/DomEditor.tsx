"use dom";

import { useEditorState } from "@/stores/editorStore";
import React, { useCallback, useEffect, useRef } from "react";
import LexicalMarkdownEditor from "./lexical/LexicalMarkdownEditor";

interface Command {
	type: string;
	payload?: Record<string, unknown>;
	timestamp: number;
}

interface EdgeInsets {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

interface DomEditorProps {
	markdown: string;
	themeMode: "light" | "dark";
	safeAreaInsets?: EdgeInsets;
	keyboardHeight?: number;
	onInsertTemplateCommand?: () => void | Promise<void>;
	command?: Command;
	dom?: import("expo/dom").DOMProps;
}

/**
 * A webview-based wrapper for the HybridEditor that runs as a DOM component.
 * This ensures the same editor stack is used on both mobile (via WebView)
 * and desktop/web (rendered as-is).
 */
export default function DomEditor({
	markdown,
	themeMode,
	safeAreaInsets,
	keyboardHeight = 0,
	command,
}: DomEditorProps) {
	const loadMarkdown = useEditorState((s) => s.loadMarkdown);
	const getContent = useEditorState((s) => s.getContent);
	const loadedMarkdownRef = useRef<string | null>(null);

	// Sync initial content or external note updates into the editor store.
	useEffect(() => {
		if (markdown !== loadedMarkdownRef.current && markdown !== getContent()) {
			loadMarkdown(markdown);
			loadedMarkdownRef.current = markdown;
		}
	}, [markdown, loadMarkdown, getContent]);

	const handleMarkdownChange = useCallback(
		(nextMarkdown: string) => {
			if (nextMarkdown === useEditorState.getState().getContent()) {
				return;
			}
			loadMarkdown(nextMarkdown);
		},
		[loadMarkdown],
	);

	return (
		<LexicalMarkdownEditor
			command={command}
			keyboardHeight={keyboardHeight}
			markdown={markdown}
			onMarkdownChange={handleMarkdownChange}
			safeAreaInsets={safeAreaInsets}
			themeMode={themeMode}
		/>
	);
}
