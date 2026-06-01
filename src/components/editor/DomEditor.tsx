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
import type { BlockNode, BlockType } from "./core/BlockNode";

import { executeEditorCommand } from "./keyboard/editorCommands";
import { useEditorCommandContext } from "./keyboard/useEditorCommandContext";

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
	markdown: string;
	themeMode: "light" | "dark";
	safeAreaInsets?: EdgeInsets;
	keyboardHeight?: number;
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
	safeAreaInsets,
	keyboardHeight = 0,
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

	const loadedMarkdownRef = useRef<string | null>(null);

	// Sync initial content or external note updates into the editor store.
	useEffect(() => {
		if (markdown !== loadedMarkdownRef.current && markdown !== getContent()) {
			loadMarkdown(markdown);
			loadedMarkdownRef.current = markdown;
		}
	}, [markdown, loadMarkdown, getContent]);

	// Handle incoming commands from native
	useEffect(() => {
		if (!command) return;

		const { type, payload } = command;
		const state = useEditorState.getState();
		const getFocusedIndex = () => state.getFocusedBlockIndex() ?? 0;

		switch (type) {
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
				if (payload?.block) {
					state.insertBlockAfter(getFocusedIndex(), payload.block as BlockNode);
				}
				break;
			case "loadMarkdown":
				if (typeof payload?.markdown === "string") {
					loadMarkdown(payload.markdown);
				}
				break;
			case "updateType":
				if (payload?.type) {
					const index = getFocusedIndex();
					state.updateBlockType(
						index,
						payload.type as BlockType,
						payload.language as string,
					);
					if (payload.attributes) {
						state.updateBlockAttributes(
							index,
							payload.attributes as Record<string, unknown>,
						);
					}
				}
				break;
		}
	}, [command, commandContext, loadMarkdown]);

	const theme = themeMode === "light" ? lightTheme : darkTheme;

	return (
		<ThemeProvider value={theme}>
			<GestureHandlerRootView style={styles.container}>
				<EditorScrollProvider>
					<HybridEditor
						onInsertTemplateCommand={onInsertTemplateCommand}
						safeAreaInsets={safeAreaInsets}
						keyboardHeight={keyboardHeight}
					/>
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
