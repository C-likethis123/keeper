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
	hasAttachment?: boolean;
	markdown: string;
	themeMode: "light" | "dark";
	safeAreaInsets?: EdgeInsets;
	keyboardHeight?: number;
	onAttachDocument?: () => void;
	onInsertImage?: () => void;
	onInsertTemplateCommand?: () => void | Promise<void>;
	onOpenWikiLink?: (title: string) => void | Promise<void>;
	onRemoveAttachment?: () => void;
	onShowVideoModal?: () => void;
	onToggleActivePanel?: () => void;
	onToggleArticle?: () => void;
	onToggleRelatedNotes?: () => void;
	command?: Command;
	dom?: import("expo/dom").DOMProps;
}

/**
 * App-level wrapper for the Lexical DOM editor.
 * The Lexical editor itself runs as the DOM component on native.
 */
export default function DomEditor({
	hasAttachment = false,
	markdown,
	themeMode,
	safeAreaInsets,
	keyboardHeight = 0,
	command,
	onAttachDocument,
	onInsertImage,
	onInsertTemplateCommand,
	onOpenWikiLink,
	onRemoveAttachment,
	onShowVideoModal,
	onToggleActivePanel,
	onToggleArticle,
	onToggleRelatedNotes,
	dom,
}: DomEditorProps) {
	const loadMarkdown = useEditorState((s) => s.loadMarkdown);
	const setCurrentMarkdown = useEditorState((s) => s.setCurrentMarkdown);
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
			setCurrentMarkdown(nextMarkdown);
		},
		[setCurrentMarkdown],
	);

	return (
		<LexicalMarkdownEditor
			command={command}
			hasAttachment={hasAttachment}
			keyboardHeight={keyboardHeight}
			markdown={markdown}
			onAttachDocument={onAttachDocument}
			onInsertImage={onInsertImage}
			onInsertTemplateCommand={onInsertTemplateCommand}
			onMarkdownChange={handleMarkdownChange}
			onOpenWikiLink={onOpenWikiLink}
			onRemoveAttachment={onRemoveAttachment}
			onShowVideoModal={onShowVideoModal}
			onToggleActivePanel={onToggleActivePanel}
			onToggleArticle={onToggleArticle}
			onToggleRelatedNotes={onToggleRelatedNotes}
			safeAreaInsets={safeAreaInsets}
			themeMode={themeMode}
			dom={dom}
		/>
	);
}
