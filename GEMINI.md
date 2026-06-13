# GEMINI.md

This file provides guidance to Gemini when working with code in this repository.
Use serena MCP when searching in the codebase or trying to apply changes to code.

## Commands

```bash
npm install           # Install dependencies
npm start             # Start Expo/metro dev server

# Mobile
npm run build:android     # Prod Android: prebuild → Rust bridge → release APK → install
# Desktop (requires Rust + Xcode CLT)
npm run desktop       # Start Tauri desktop window
npm run build:desktop # Build production desktop app → src-tauri/target/release/

# Utilities
npm test                  # Test unit suite
npm run lint              # Biome linter
npm run lint:fix          # Auto-fix lint issues
```

Automated tests exist for pure modules and selected UI/routes. Use `npm run lint` for CI checks, and run `npm test` when touching covered areas.

### Android Build Variants

Two separate apps with distinct bundle IDs coexist on the same device:

| | Dev | Prod |
|--|-----|------|
| **Script** | `npm run android:dev` | `npm run build:android` |
| **App name** | Keeper (Dev) | Keeper |
| **Bundle ID** | `com.clikethis123.keeper.dev` | `com.clikethis123.keeper` |
| **JS source** | Metro server (hot reload) | Bundled in APK |

`APP_VARIANT=development` in `app.config.js` controls which variant is built.

## Architecture

> **Note**: The editor architecture is currently undergoing a migration to Lexical.

Keeper is a cross-platform block-based markdown note editor (iOS/Android/web/desktop via Tauri) with GitHub-backed storage.

### Layers

1. **Screens** (`app/`) — expo-router file-based routing. `index.tsx` = note grid, `editor.tsx` = editor screen, `_layout.tsx` = app initialization + git setup.

2. **Components** (`components/`) — UI layer. `NoteEditorView.tsx` is the main editor container combining `EditorToolbar` + `DomEditor`.

3. **State** (`stores/`) — Two Zustand stores:
   - `editorStore.ts` — All editor operations (document, selection, block manipulation, undo/redo). Backed by `editorReducer` (pure function) and `History` singleton. Note: In the unified editor architecture, this store exists in both the native context (for persistence/auto-save) and the DOM component context (for editing).
   - `toastStore.ts` — Toast notifications with auto-dismiss.

4. **Hooks** (`hooks/`) — Business logic: `useAutoSave` (2s debounce), `useNotes` (paginated listing), `useLoadNote`, `useToolbarActions`, `useFocusBlock`. Wiki link autocomplete state lives in `WikiLinkProvider` / `useWikiLinkContext` (editor/wikilinks).

5. **Services** (`services/`) — Persistence:
   - `services/notes/` — `noteService.ts` (CRUD), `notesIndex.ts` (SQLite full-text search), `Notes.ts`/`Notes.web.ts` (platform FS abstraction)
   - `services/git/` — `gitService.ts` (batched commit queue), `gitInitializationService.ts` (clone/validate on launch), `gitApi.ts` (Octokit GitHub API)

### Editor Model (`components/editor/core/`)

An **immutable, transaction-based** document model:
- `Document` — flat list of immutable `BlockNode`s with a version number
- `BlockNode` — type (paragraph, heading1-3, bulletList, numberedList, checkboxList, codeBlock, mathBlock, image), content string, attributes (listLevel, language, checked)
- `Transaction` — groups operations atomically; each operation has `.inverse()` for undo
- `History` — undo/redo stack of Transactions
- `EditorReducer` — pure function, all state changes flow through here

### Rendering

- `DomEditor` — DOM component wrapper that renders the Lexical markdown editor and syncs markdown back into the document model
- `LexicalMarkdownEditor` — canonical editing surface with Lexical extensions for toolbar actions, code blocks, equations, images, and wiki links
- Legacy `UnifiedBlock` / `BlockRegistry` rendering has been removed; do not add new block UI through that path.

### Data Persistence (three-tier)

1. **File system** via a Rust bridge that interacts with native file system
2. **SQLite** via a Rust bridge — full-text search index (title, summary, pinned, timestamp); rebuilt on git clone detection
3. **Git** via Rust `git_core` bridge — batched, debounced commits; optional push to GitHub

## Scroll management

This note editor manages scrolling via EditorScrollContext.

### Environment Variables

```
EXPO_PUBLIC_GITHUB_OWNER=<owner>
EXPO_PUBLIC_GITHUB_REPO=<repo>
EXPO_PUBLIC_GITHUB_TOKEN=<token>
EXPO_PUBLIC_GIT_API_URL=<backend-url>   # optional remote backend
```

## Key Conventions

- **Immutability**: `Document`, `BlockNode`, `Transaction` are frozen. Never mutate them directly.
- **All editor state changes go through `editorStore` actions** — don't modify document state outside the store.
- **Linting/formatting**: Biome (not ESLint/Prettier). Install the Biome VS Code extension.
- **Platform splits**: Files ending in `.web.ts` override their `.ts` counterpart on web (e.g., `Notes.web.ts`).
- **Testing**: Use `npm test` for testing, and `npm run lint` for Biome checks.
