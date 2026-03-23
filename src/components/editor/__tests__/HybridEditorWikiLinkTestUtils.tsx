import { EditorScrollProvider } from "@/components/editor/EditorScrollContext";
import { HybridEditor } from "@/components/editor/HybridEditor";
import { NoteService } from "@/services/notes/noteService";
import { NotesIndexService } from "@/services/notes/notesIndex";
import { useEditorState } from "@/stores/editorStore";
import { render } from "@testing-library/react-native";
import React from "react";
import { Platform } from "react-native";

export const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	useRouter: () => ({
		push: (...args: unknown[]) => mockPush(...args),
	}),
}));

jest.mock("@/services/notes/notesIndex", () => ({
	NotesIndexService: {
		listNotes: jest.fn(),
	},
}));

jest.mock("@/services/notes/noteService", () => ({
	NoteService: {
		saveNote: jest.fn(),
	},
}));

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			background: "#ffffff",
			card: "#f9fafb",
			border: "#d0d7de",
			text: "#111827",
			textMuted: "#6b7280",
			primary: "#2563eb",
			primaryContrast: "#ffffff",
			primaryPressed: "#1d4ed8",
			shadow: "#000000",
			error: "#dc2626",
		},
		custom: {
			editor: {
				placeholder: "#9ca3af",
			},
		},
		typography: {
			body: { fontSize: 16 },
			heading1: { fontSize: 28, fontWeight: "700" },
			heading2: { fontSize: 24, fontWeight: "700" },
			heading3: { fontSize: 20, fontWeight: "700" },
		},
	}),
}));

jest.mock("@/components/editor/keyboard/useEditorKeyboardShortcuts", () => ({
	useEditorKeyboardShortcuts: () => {},
}));

const originalPlatformOs = Platform.OS;
export const mockListNotes = jest.mocked(NotesIndexService.listNotes);
export const mockSaveNote = jest.mocked(NoteService.saveNote);

export function setPlatformOs(value: "ios" | "android" | "web") {
	Object.defineProperty(Platform, "OS", {
		configurable: true,
		value,
	});
}

export function restorePlatformOs() {
	Object.defineProperty(Platform, "OS", {
		configurable: true,
		value: originalPlatformOs,
	});
}

export function resetHybridEditorHarness(
	platform: "ios" | "android" | "web",
) {
	useEditorState.getState().resetState();
	mockPush.mockReset();
	mockListNotes.mockReset();
	mockSaveNote.mockReset();
	setPlatformOs(platform);
}

export function renderEditor(markdown: string) {
	useEditorState.getState().loadMarkdown(markdown);
	useEditorState.getState().setSelection(null);

	return render(
		<EditorScrollProvider>
			<HybridEditor />
		</EditorScrollProvider>,
	);
}
