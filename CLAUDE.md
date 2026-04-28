# CLAUDE.md

## Commands

See [package.json](./package.json) for available commands.

## Architecture

Keeper is a cross-platform block-based markdown editor (iOS/Android/web/desktop via Tauri) with GitHub-backed storage.

### Layers

1. **Screens** (`app/`) — expo-router file-based routing. `index.tsx` = note grid, `editor.tsx` = editor, `_layout.tsx` = app init + git setup.

2. **Components** (`components/`) — UI layer. `NoteEditorView` = editor container (toolbar + hybrid editor + split panels).

3. **State** (`stores/`) — Zustand stores:
   - `editorStore` — editor operations (document, selection, blocks, undo/redo)
   - `toastStore` — toast notifications
   - `storageStore` — storage initialization state

4. **Hooks** (`hooks/`) — Business logic:
   - `useAutoSave`, `useNotes`, `useLoadNote`, `useToolbarActions`, `useFocusBlock`
   - `useAppStartup` — startup orchestration
   - `useAppKeyboardShortcuts` — app-level shortcuts (`Cmd+K/N/S`)
   - `useShareHandler` — YouTube/URL share

**Common Mistakes & Troubleshooting:**
* **Error 153: Video player configuration error:** This is a common mistake when embedding YouTube videos. Ensure that the video ID is correctly formatted and that the embedding parameters are valid. Double-check the source URL for any typos or missing characters.