import ExpoLexicalMarkdownEditor from "@keeper/components/editor/lexical/LexicalMarkdownEditor";
import type { PastedImage } from "@keeper/components/editor/lexical/extensions/MarkdownPasteExtension";
import type { LexicalEditorCommand } from "@keeper/components/editor/lexical/extensions/CommandExtension";
import { useCallback, useEffect, useState } from "react";

type Props = {
	value: string;
	onChange: (value: string) => void;
	editorKey?: string;
	onRequestImage?: () => Promise<{ src: string; altText?: string } | null>;
	onPasteImage?: (
		image: PastedImage,
	) => Promise<{ src: string; altText?: string } | null>;
	onAttachDocument?: () => void;
	onRemoveAttachment?: () => void;
	onShowVideoModal?: () => void;
	hasAttachment?: boolean;
	onInsertTemplateCommand?: () => void;
	onOpenWikiLink?: (title: string) => void;
	onToggleArticle?: () => void;
	onToggleActivePanel?: () => void;
	onToggleRelatedNotes?: () => void;
	templateCommand?: { markdown: string; timestamp: number } | null;
};

/** Browser adapter for canonical Expo DOM editor. */
export function LexicalEditor({
	editorKey,
	hasAttachment,
	onAttachDocument,
	onChange,
	onInsertTemplateCommand,
	onOpenWikiLink,
	onPasteImage,
	onRemoveAttachment,
	onRequestImage,
	onShowVideoModal,
	onToggleActivePanel,
	onToggleArticle,
	onToggleRelatedNotes,
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
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				(event.metaKey || event.ctrlKey) &&
				event.key.toLocaleLowerCase() === "f"
			) {
				event.preventDefault();
				setCommand({ type: "openFindReplace", timestamp: Date.now() });
			}
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, []);
	return (
		<ExpoLexicalMarkdownEditor
			accessibilityLabel="Note content"
			key={editorKey}
			markdown={value}
			noteId={editorKey ?? "browser-note"}
			command={command}
			hasAttachment={hasAttachment}
			onAttachDocument={onAttachDocument}
			onInsertImage={() => {
				void onRequestImage?.().then(insertImage);
			}}
			onPasteImage={(image) => onPasteImage?.(image).then(insertImage)}
			onInsertTemplateCommand={onInsertTemplateCommand}
			onOpenWikiLink={onOpenWikiLink}
			onToggleArticle={onToggleArticle}
			onToggleActivePanel={onToggleActivePanel}
			onToggleRelatedNotes={onToggleRelatedNotes}
			onMarkdownChange={onChange}
			onRemoveAttachment={onRemoveAttachment}
			onShowVideoModal={onShowVideoModal}
			persistDraft={false}
			themeMode="dark"
		/>
	);
}
