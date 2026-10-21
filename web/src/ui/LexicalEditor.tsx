import LexicalMarkdownEditor from "@keeper/components/editor/lexical/LexicalMarkdownEditor";
import type { PastedImage } from "@keeper/components/editor/lexical/extensions/MarkdownPasteExtension";
import type { LexicalEditorCommand } from "@keeper/components/editor/lexical/extensions/CommandExtension";
import { useAppKeyboardShortcuts } from "@keeper/hooks/useAppKeyboardShortcuts";
import { useCallback, useEffect, useState } from "react";

type Props = {
	value: string;
	onChange: (value: string) => void;
	editorKey?: string;
	noteId?: string;
	onRequestImage?: () => Promise<{ src: string; altText?: string } | null>;
	onPasteImage?: (
		image: PastedImage,
	) => Promise<{ src: string; altText?: string } | null>;
	onShowVideoModal?: () => void;
	onInsertTemplateCommand?: () => void;
	onOpenWikiLink?: (title: string) => void;
	onToggleActivePanel?: () => void;
	onToggleRelatedNotes?: () => void;
	onForceSave?: () => void;
	templateCommand?: { markdown: string; timestamp: number } | null;
};

/** Browser adapter for canonical Lexical editor. */
export function LexicalEditor({
	editorKey,
	noteId,
	onChange,
	onInsertTemplateCommand,
	onOpenWikiLink,
	onPasteImage,
	onRequestImage,
	onShowVideoModal,
	onToggleActivePanel,
	onToggleRelatedNotes,
	onForceSave,
	templateCommand,
	value,
}: Props) {
	const [command, setCommand] = useState<LexicalEditorCommand>();
	const insertImage = useCallback(
		async (image: { src: string; altText?: string } | null) => {
			if (image)
				setCommand({
					type: "insertImage",
					payload: image,
					timestamp: Date.now(),
				});
		},
		[],
	);
	useEffect(() => {
		if (templateCommand)
			setCommand({
				type: "insertMarkdown",
				payload: { markdown: templateCommand.markdown },
				timestamp: templateCommand.timestamp,
			});
	}, [templateCommand]);
	useAppKeyboardShortcuts({
		onForceSave,
		onOpenFindReplace: () =>
			setCommand({ type: "openFindReplace", timestamp: Date.now() }),
	});
	return (
		<LexicalMarkdownEditor
			accessibilityLabel="Note content"
			key={editorKey}
			markdown={value}
			noteId={noteId ?? editorKey ?? "browser-note"}
			command={command}
			onInsertImage={() => {
				void onRequestImage?.().then(insertImage);
			}}
			onPasteImage={(image) => onPasteImage?.(image).then(insertImage)}
			onInsertTemplateCommand={onInsertTemplateCommand}
			onOpenWikiLink={onOpenWikiLink}
			onToggleActivePanel={onToggleActivePanel}
			onToggleRelatedNotes={onToggleRelatedNotes}
			onMarkdownChange={onChange}
			onShowVideoModal={onShowVideoModal}
			persistDraft={false}
			themeMode="dark"
		/>
	);
}
