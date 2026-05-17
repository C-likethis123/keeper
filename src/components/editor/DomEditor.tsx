"use dom";

import { darkTheme } from "@/constants/themes/darkTheme";
import { lightTheme } from "@/constants/themes/lightTheme";
import { useEditorState } from "@/stores/editorStore";
import { ThemeProvider } from "@react-navigation/native";
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { EditorScrollProvider } from "./EditorScrollContext";
import { HybridEditor } from "./HybridEditor";

import { executeEditorCommand } from "./keyboard/editorCommands";
import { useEditorCommandContext } from "./keyboard/useEditorCommandContext";

interface Command {
	type: string;
	payload?: any;
	timestamp: number;
}

interface DomEditorProps {
	markdown: string;
	themeMode: "light" | "dark";
	onContentChange: (markdown: string) => Promise<void>;
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
	onContentChange,
	onInsertTemplateCommand,
	command,
}: DomEditorProps) {
	const loadMarkdown = useEditorState((s) => s.loadMarkdown);
	const getContent = useEditorState((s) => s.getContent);

	const commandContext = useEditorCommandContext({
		isEditorActive: true,
		isWikiLinkModalOpen: false,
		dismissOverlays: () => false,
	});

	const loadedRef = useRef(false);
	const lastReportedMarkdownRef = useRef(markdown);

	// Sync initial content or external updates
	useEffect(() => {
		if (
			!loadedRef.current ||
			(markdown !== lastReportedMarkdownRef.current &&
				markdown !== getContent())
		) {
			loadMarkdown(markdown);
			loadedRef.current = true;
			lastReportedMarkdownRef.current = markdown;
		}
	}, [markdown, loadMarkdown, getContent]);

	// Handle incoming commands from native
	useEffect(() => {
		if (!command) return;

		switch (command.type) {
			case "undo":
				executeEditorCommand("undo", commandContext);
				break;
			case "redo":
				executeEditorCommand("redo", commandContext);
				break;
			case "indent":
				executeEditorCommand("indentListItem", commandContext);
				break;
			case "outdent":
				executeEditorCommand("outdentListItem", commandContext);
				break;
			case "insertBlock":
				if (command.payload?.block) {
					const state = useEditorState.getState();
					const index = state.getFocusedBlockIndex() ?? 0;
					state.insertBlockAfter(index, command.payload.block);
				}
				break;
			case "updateType":
				if (command.payload?.type) {
					const state = useEditorState.getState();
					const index = state.getFocusedBlockIndex() ?? 0;
					state.updateBlockType(
						index,
						command.payload.type,
						command.payload.language,
					);
					if (command.payload.attributes) {
						state.updateBlockAttributes(index, command.payload.attributes);
					}
				}
				break;
		}
	}, [command, commandContext]);

	// Sync changes back to native
	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout>;

		const unsubscribe = useEditorState.subscribe(
			(state) => state.document.version,
			() => {
				if (timeoutId) clearTimeout(timeoutId);

				timeoutId = setTimeout(() => {
					const currentMarkdown = getContent();
					if (currentMarkdown !== lastReportedMarkdownRef.current) {
						lastReportedMarkdownRef.current = currentMarkdown;
						onContentChange(currentMarkdown);
					}
				}, 200); // 200ms debounce for bridge reports
			},
		);

		return () => {
			unsubscribe();
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, [getContent, onContentChange]);

	const theme = themeMode === "light" ? lightTheme : darkTheme;

	return (
		<ThemeProvider value={theme}>
			<GestureHandlerRootView style={styles.container}>
				<EditorScrollProvider>
					<HybridEditor onInsertTemplateCommand={onInsertTemplateCommand} />
				</EditorScrollProvider>
			</GestureHandlerRootView>
		</ThemeProvider>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
