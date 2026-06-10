import React from "react";
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
	onMarkdownChange: (markdown: string) => void;
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
	onMarkdownChange,
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
	return (
		<LexicalMarkdownEditor
			command={command}
			hasAttachment={hasAttachment}
			keyboardHeight={keyboardHeight}
			markdown={markdown}
			onAttachDocument={onAttachDocument}
			onInsertImage={onInsertImage}
			onInsertTemplateCommand={onInsertTemplateCommand}
			onMarkdownChange={onMarkdownChange}
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
