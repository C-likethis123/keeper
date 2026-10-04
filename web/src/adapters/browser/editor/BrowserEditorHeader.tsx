import NoteEditorHeader from "@/components/NoteEditorHeader";
import { darkTheme } from "@keeper/constants/themes/darkTheme";
import type { EditorHeaderProps } from "@keeper/features/editor/editor-header-contract";
import { ThemeProvider } from "@/constants/themes/ThemeProvider";
import { SafeAreaProvider } from "@/components/shared/SafeArea";

/** Browser boundary for the unchanged source editor header. */
export function BrowserEditorHeader(props: EditorHeaderProps) {
	return (
		<ThemeProvider value={darkTheme}>
			<SafeAreaProvider>
				<NoteEditorHeader {...props} />
			</SafeAreaProvider>
		</ThemeProvider>
	);
}
