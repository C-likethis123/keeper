# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm install           # Install dependencies
npm start             # Start Expo/metro dev server

# Mobile
npm run android       # Prod Android: prebuild → Rust bridge → release APK → install
npm run android:dev   # Dev Android: prebuild (dev variant) → Rust bridge → debug APK → install → metro
npm run ios           # Run iOS via Expo CLI

# Desktop (requires Rust + Xcode CLT)
npm run desktop       # Start Tauri desktop window
npm run build:desktop # Build production desktop app → src-tauri/target/release/

# Utilities
npm run build:mobile-git  # Rebuild Rust git bridge (all platforms)
npm run lint              # Biome linter
npm run lint:fix          # Auto-fix lint issues
```

No automated test suite. Use `npm run lint` for CI checks.

### Android Build Variants

Two separate apps with distinct bundle IDs coexist on the same device:

| | Dev | Prod |
|--|-----|------|
| **Script** | `npm run android:dev` | `npm run android` |
| **App name** | Keeper (Dev) | Keeper |
| **Bundle ID** | `com.clikethis123.keeper.dev` | `com.clikethis123.keeper` |
| **JS source** | Metro server (hot reload) | Bundled in APK |

`APP_VARIANT=development` in `app.config.js` controls which variant is built.

## Architecture

Keeper is a cross-platform block-based markdown note editor (iOS/Android/web/desktop via Tauri) with GitHub-backed storage.

### Layers

1. **Screens** (`app/`) — expo-router file-based routing. `index.tsx` = note grid, `editor.tsx` = editor screen, `_layout.tsx` = app initialization + git setup.

2. **Components** (`components/`) — UI layer. `NoteEditorView.tsx` is the main editor container combining `EditorToolbar` + `HybridEditor`.

3. **State** (`stores/`) — Two Zustand stores:
   - `editorStore.ts` — All editor operations (document, selection, block manipulation, undo/redo). Backed by `editorReducer` (pure function) and `History` singleton.
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

- `HybridEditor` — container: keyboard shortcuts, wiki link overlay, content sync between document model and React state
- `UnifiedBlock` — single block: `TextInput` for editing + `InlineMarkdown` for formatted preview
- `BlockRegistry` — maps `BlockType` → specialized component (CodeBlock, MathBlock, etc.)

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
- **No test suite**: Rely on TypeScript + Biome for correctness checking.

## Commit conventions

Refer to @COMMIT_CONVENTIONS.md
