import { useEditorState } from "@/stores/editorStore";
import { useEffect } from "react";

// TODO: figure out if we can do this without using a ref. Maybe a `usePrevious` hook would be useful.
export function DocumentSync({
	onChanged,
	lastInitialContentRef,
	lastEmittedMarkdownRef,
}: {
	onChanged?: (markdown: string) => void;
	lastInitialContentRef: React.MutableRefObject<string | undefined>;
	lastEmittedMarkdownRef: React.MutableRefObject<string | undefined>;
}) {
	const document = useEditorState((s) => s.document);
	const toMarkdown = useEditorState((s) => s.toMarkdown);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refs intentionally excluded; document triggers sync on edit
	useEffect(() => {
		if (onChanged && lastInitialContentRef.current !== undefined) {
			const markdown = toMarkdown();
			lastEmittedMarkdownRef.current = markdown;
			onChanged(markdown);
		}
	}, [onChanged, toMarkdown, document]);

	return null;
}
