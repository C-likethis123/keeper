import { normalizeKeyEvent } from "@/components/editor/keyboard/normalizeKeyEvent";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { getAppShortcutCommand } from "./appShortcutRegistry";

interface AppKeyboardShortcutCallbacks {
	onFocusSearch?: () => void;
	onCreateNote?: () => void;
	onForceSave?: () => void;
}

export function useAppKeyboardShortcuts(
	callbacks: AppKeyboardShortcutCallbacks,
) {
	const callbacksRef = useRef(callbacks);

	useEffect(() => {
		callbacksRef.current = callbacks;
	});

	useEffect(() => {
		if (Platform.OS !== "web") return;

		const handleKeyDown = (event: KeyboardEvent) => {
			const normalized = normalizeKeyEvent(event);
			if (!normalized) return;

			const commandId = getAppShortcutCommand(normalized.chord);
			if (!commandId) return;

			const { onFocusSearch, onCreateNote, onForceSave } = callbacksRef.current;
			let handler: (() => void) | undefined;
			switch (commandId) {
				case "focusSearch":
					handler = onFocusSearch;
					break;
				case "createNote":
					handler = onCreateNote;
					break;
				case "forceSave":
					handler = onForceSave;
					break;
			}
			if (!handler) return;

			event.preventDefault();
			void handler();
		};

		document.addEventListener("keydown", handleKeyDown, true);
		return () => {
			document.removeEventListener("keydown", handleKeyDown, true);
		};
	}, []);
}
