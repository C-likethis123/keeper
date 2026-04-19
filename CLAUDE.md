# CLAUDE.md

## Commands

See [package.json](./package.json) for a list of available commands.

## Architecture

Keeper cross-platform block-based markdown editor (iOS/Android/web/desktop via Tauri), GitHub-backed storage.

### Layers

1. **Screens** (`app/`) — expo-router file-based routing. `index.tsx` = note grid, `editor.tsx` = editor screen, `_layout.tsx` = app init + git setup.

2. **Components** (`components/`) — UI layer. `NoteEditorView.tsx` main editor container: `EditorToolbar` + `HybridEditor`.

3. **State** (`stores/`) — Two Zustand stores:
   - `editorStore.ts` — Editor ops (document, selection, block manipulation, undo/redo). Backed by `editorReducer` (pure function) + `History` singleton.
   - `toastStore.ts` — Toast notifications, auto-dismiss.

4. **Hooks** (`hooks/`) — Business logic: `useAutoSave` (2s debounce), `useNotes` (paginated listing), `useLoadNote`, `useToolbarActions`, `useFocusBlock`. Wiki link autocomplete state: `WikiLinkProvider` / `useWikiLinkContext` (editor/wikilinks).

5. **Services** (`services/`) — Persistence:
   - `services/notes/` — `noteService.ts` (CRUD), `notesIndex.ts` (SQLite full-text search), `Notes.ts`/`Notes.web.ts` (platform FS abstraction), `clusterService.ts` (MOC suggestions)
   - `services/git/` — `gitService.ts` (batched commit queue), `gitInitializationService.ts` (clone/validate on launch), `gitApi.ts` (Octokit GitHub API)
   - `hooks/` — `useShareHandler.ts` (YouTube/URL share intent processing)

### Editor Model (`components/editor/core/`)

**Immutable, transaction-based** document model:
- `Document` — flat list immutable `BlockNode`s, version number
- `BlockNode` — type (paragraph, heading1-3, bulletList, numberedList, checkboxList, codeBlock, mathBlock, image), content string, attributes (listLevel, language, checked)
- `Transaction` — groups ops atomically; each op has `.inverse()` undo
- `History` — undo/redo stack of Transactions
- `EditorReducer` — pure function, all state changes flow through

### Rendering

- `HybridEditor` — container: keyboard shortcuts, wiki link overlay, content sync between document model and React state
- `UnifiedBlock` — single block: `TextInput` editing + `InlineMarkdown` formatted preview
- `BlockRegistry` — maps `BlockType` → specialized component (CodeBlock, MathBlock, etc.)

### Data Persistence (three-tier)

1. **File system** via Rust git bridge
2. **SQLite** via `expo-sqlite` — full-text search index (title, summary, pinned, timestamp); rebuilt on git clone detection
3. **Git** via Rust `git_core` bridge — batched, debounced commits; optional push to GitHub

## Rust Git Runtime

Shared Rust git core `src-tauri/git_core` (`git2`/libgit2 bindings).

- Rust core API: `clone_repo`, `fetch`, `checkout`, `current_branch`, `list_branches`, `merge`, `commit`, `push`, `status`, `head_oid`, `changed_markdown_paths`
- C ABI native bridges: `git_*` functions, JSON helpers for branch/status/head/diff payloads
- Tauri commands `src-tauri/src/lib.rs`: `git_*_repo` including `git_head_oid_repo`, `git_changed_markdown_paths_repo`

TS git abstraction:
- `src/services/git/engines/GitEngine.ts`
- `src/services/git/engines/RustGitEngine.ts`
- `src/services/git/gitEngine.ts`

Mobile native bridge — Expo module source of truth:
- `modules/keeper-git/android/src/main/java/com/clikethis123/keeper/KeeperGitBridgeModule.kt`
- `modules/keeper-git/ios/KeeperGitBridgeModule.swift`
- `modules/keeper-git/scripts/build-rust.sh`


## Scroll Management

Editor scrolling via `EditorScrollContext`.

## Key Conventions

- **Expo CLI**: Verify Expo docs or `npx expo <command> --help`. Prefer idiomatic solutions.
- **Immutability**: `Document`, `BlockNode`, `Transaction` frozen. Never mutate directly.
- **Editor state**: All changes through `editorStore` actions — don't modify document state outside store.
- **Platform splits**: `.web.ts` files override `.ts` counterpart on web (e.g., `Notes.web.ts`).
- **Testing**: `npm test` Jest suite (pure TS modules + selected RN UI routes/components); `npm run lint` Biome checks.

