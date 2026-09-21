import ExpoLexicalMarkdownEditor from "@keeper/components/editor/lexical/LexicalMarkdownEditor";

type Props = {
	value: string;
	onChange: (value: string) => void;
	editorKey?: string;
};

/** Browser adapter for canonical Expo DOM editor. */
export function LexicalEditor({ editorKey, onChange, value }: Props) {
	return (
		<ExpoLexicalMarkdownEditor
			accessibilityLabel="Note content"
			key={editorKey}
			markdown={value}
			noteId={editorKey ?? "browser-note"}
			onMarkdownChange={onChange}
			persistDraft={false}
			themeMode="dark"
		/>
	);
}
