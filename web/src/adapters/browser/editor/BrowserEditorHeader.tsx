import { NativeEditorHeader } from "@keeper/adapters/native/editor/NativeEditorHeader";
import { darkTheme } from "@keeper/constants/themes/darkTheme";
import type { EditorHeaderProps } from "@keeper/features/editor/editor-header-contract";
import { ThemeProvider } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";

/** Browser boundary for the unchanged source editor header. */
export function BrowserEditorHeader(props: EditorHeaderProps) {
	return (
		<ThemeProvider value={darkTheme}>
			<SafeAreaProvider>
				<NativeEditorHeader {...props} />
			</SafeAreaProvider>
		</ThemeProvider>
	);
}
