// This component has been split into platform-specific implementations:
// - NoteEditorView.web.tsx (Tauri desktop - uses @tauri-apps/plugin-dialog)
// - NoteEditorView.native.tsx (iOS/Android - uses expo-document-picker)
//
// Re-export from .native.ts as a fallback for TypeScript/bundler resolution
export { default } from "./NoteEditorView.native";
