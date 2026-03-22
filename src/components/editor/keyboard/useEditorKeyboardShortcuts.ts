import type { DocumentSelection } from "@/components/editor/core/Selection";
import { useEditorSelection } from "@/stores/editorStore";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import {
	type EditorCommandContext,
	executeEditorCommand,
} from "./editorCommands";
import { normalizeKeyEvent } from "./normalizeKeyEvent";
import { getShortcutCommand } from "./shortcutRegistry";
import { getVerticalNavigationTarget } from "./verticalNavigation";

interface UseEditorKeyboardShortcutsOptions {
	context: EditorCommandContext;
}

function shouldHandleGlobalShortcut(
	context: EditorCommandContext,
	selection: DocumentSelection | null,
) {
	return (
		context.isWikiLinkModalOpen ||
		context.getHasBlockSelection() ||
		(context.isEditorActive && selection !== null)
	);
}

export function useEditorKeyboardShortcuts({
	context,
}: UseEditorKeyboardShortcutsOptions) {
	const selection = useEditorSelection();
	const latestContextRef = useRef(context);
	const latestSelectionRef = useRef(selection);

	useEffect(() => {
		latestContextRef.current = context;
	}, [context]);

	useEffect(() => {
		latestSelectionRef.current = selection;
	}, [selection]);

	useEffect(() => {
		if (Platform.OS !== "web") return;

		const handleKeyDown = (event: KeyboardEvent) => {
			const latestContext = latestContextRef.current;
			const latestSelection = latestSelectionRef.current;
			if (!shouldHandleGlobalShortcut(latestContext, latestSelection)) {
				return;
			}

			const normalized = normalizeKeyEvent(event);
			if (!normalized) return;

			if (latestContext.isWikiLinkModalOpen && normalized.key !== "Escape") {
				return;
			}

			if (normalized.key === "ArrowUp" || normalized.key === "ArrowDown") {
				const blockIndex = latestContext.getFocusedBlockIndex();
				if (blockIndex === null) return;

				const target = getVerticalNavigationTarget({
					direction: normalized.key === "ArrowUp" ? "up" : "down",
					document: latestContext.getDocument(),
					blockIndex,
					selection: latestSelection,
				});

				if (!target) return;

				event.preventDefault();
				latestContext.focusBlockAt(target.blockIndex, target.offset);
				return;
			}

			const commandId = getShortcutCommand(normalized.chord);
			if (!commandId) return;

			const handled = executeEditorCommand(commandId, latestContext);
			if (handled) {
				event.preventDefault();
			}
		};

		document.addEventListener("keydown", handleKeyDown, true);
		return () => {
			document.removeEventListener("keydown", handleKeyDown, true);
		};
	}, []);
}
