import ExpoLexicalMarkdownEditor from "@keeper/components/editor/lexical/LexicalMarkdownEditor";
import type { PastedImage } from "@keeper/components/editor/lexical/extensions/MarkdownPasteExtension";
import type { LexicalEditorCommand } from "@keeper/components/editor/lexical/extensions/CommandExtension";
import { useCallback, useEffect, useState } from "react";

type Props = {
	value: string;
	onChange: (value: string) => void;
	editorKey?: string;
	onRequestImage?: () => Promise<{ src: string; altText?: string } | null>;
	onPasteImage?: (image: PastedImage) => Promise<{ src: string; altText?: string } | null>;
	onAttachDocument?: () => void;
	onRemoveAttachment?: () => void;
	onShowVideoModal?: () => void;
	hasAttachment?: boolean;
	onInsertTemplateCommand?: () => void;
	templateCommand?: { markdown: string; timestamp: number } | null;
};

/** Browser adapter for canonical Expo DOM editor. */
export function LexicalEditor({ editorKey, hasAttachment, onAttachDocument, onChange, onInsertTemplateCommand, onPasteImage, onRemoveAttachment, onRequestImage, onShowVideoModal, templateCommand, value }: Props) {
	const [command, setCommand] = useState<LexicalEditorCommand>();
	const insertImage = useCallback(async (image: { src: string; altText?: string } | null) => { if (image) setCommand({ type: "insertImage", payload: image, timestamp: Date.now() }); }, []);
	useEffect(() => { if (templateCommand) setCommand({ type: "insertMarkdown", payload: { markdown: templateCommand.markdown }, timestamp: templateCommand.timestamp }); }, [templateCommand]);
	return (
		<ExpoLexicalMarkdownEditor
			accessibilityLabel="Note content"
			key={editorKey}
			markdown={value}
			noteId={editorKey ?? "browser-note"}
			command={command}
			hasAttachment={hasAttachment}
			onAttachDocument={onAttachDocument}
			onInsertImage={() => { void onRequestImage?.().then(insertImage); }}
			onPasteImage={(image) => onPasteImage?.(image).then(insertImage)}
			onInsertTemplateCommand={onInsertTemplateCommand}
			onMarkdownChange={onChange}
			onRemoveAttachment={onRemoveAttachment}
			onShowVideoModal={onShowVideoModal}
			persistDraft={false}
			themeMode="dark"
		/>
	);
}
