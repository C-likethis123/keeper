# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm start            # Start Expo dev server (interactive: press w for web, i for iOS, a for Android)
npm run web          # Run web on port 8081
npm run desktop      # Start Tauri desktop window (requires Rust + Xcode CLT)
npm run lint         # Biome linter
npm run lint:fix     # Auto-fix lint issues
npm run build:web    # Export web bundle
npm run build:desktop # Build production desktop app → src-tauri/target/release/
```

No automated test suite. Use `npm run lint` for CI checks.

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

1. **File system** via `expo-file-system` — notes as `{id}.md` with YAML frontmatter (gray-matter)
2. **SQLite** via `expo-sqlite` — full-text search index (title, summary, pinned, timestamp); rebuilt on git clone detection
3. **Git** via Rust `git_core` bridge — batched, debounced commits; optional push to GitHub

## Rust Git Runtime

Keeper uses a shared Rust git core in `src-tauri/git_core` (`git2`/libgit2 bindings).

- Rust core API: `clone_repo`, `fetch`, `checkout`, `current_branch`, `list_branches`, `merge`, `commit`, `push`, `status`, `head_oid`, `changed_markdown_paths`
- C ABI for native bridges: `git_*` functions including JSON helpers for branch/status/head/diff payloads
- Tauri commands in `src-tauri/src/lib.rs`: `git_*_repo` including `git_head_oid_repo` and `git_changed_markdown_paths_repo`

TypeScript git abstraction:
- `src/services/git/engines/GitEngine.ts`
- `src/services/git/engines/RustGitEngine.ts`
- `src/services/git/gitEngine.ts`

Mobile native bridge:
- Android bridge integrated:
  - `android/app/src/main/java/com/clikethis123/keeper/KeeperGitBridgeModule.kt`
  - `android/app/src/main/java/com/clikethis123/keeper/KeeperGitBridgePackage.kt`
  - `MainApplication.kt` package registration
- iOS bridge integrated:
  - `ios/native/KeeperGitBridge.swift`
  - `ios/native/KeeperGitBridge.m`
  - `ios/native.xcodeproj/project.pbxproj` includes bridge sources and `native/libgit_core.a` linkage

Runtime support policy:
- Supported: Tauri desktop, Android native build, iOS native build
- Unsupported (startup failure by design): web, Expo Go

## Scroll management

This note editor manages scrolling via EditorScrollContext.

### Environment Variables

```
EXPO_PUBLIC_GITHUB_OWNER=<owner>
EXPO_PUBLIC_GITHUB_REPO=<repo>
EXPO_PUBLIC_GITHUB_TOKEN=<token>
EXPO_PUBLIC_GIT_API_URL=<backend-url>   # optional remote backend
```

## Key Conventions for Claude

- **Expo CLI**: Before suggesting flags or options, verify them against the Expo docs or by running `npx expo <command> --help`. Prefer idiomatic solutions (e.g., `BROWSER=none` env var to suppress browser auto-open) over unverified flags.

## Key Conventions

- **Immutability**: `Document`, `BlockNode`, `Transaction` are frozen. Never mutate them directly.
- **All editor state changes go through `editorStore` actions** — don't modify document state outside the store.
- **Linting/formatting**: Biome (not ESLint/Prettier). Install the Biome VS Code extension.
- **Platform splits**: Files ending in `.web.ts` override their `.ts` counterpart on web (e.g., `Notes.web.ts`).
- **No test suite**: Rely on TypeScript + Biome for correctness checking.

## Commit conventions

Refer to @COMMIT_CONVENTIONS.md
