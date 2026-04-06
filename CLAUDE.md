# CLAUDE.md

## Planning & Roadmap

**Check `ROADMAP.md` before new work:**
- Critical issues (P1, P2) requiring fixes
- Development phases, shipped feature status
- Known issues, improvements
- Feature backlog

Summaries also `TODO.md`, `BUGS.md`.

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
npm run build:desktop # Build prod desktop app → src-tauri/target/release/

# Utilities
npm run build:mobile-git  # Rebuild Rust git bridge (all platforms)
npm test                  # Jest suite (pure modules + UI/routes)
npm run lint              # Biome linter
npm run lint:fix          # Auto-fix lint issues
```

Tests cover pure modules, selected UI/routes. `npm run lint` for CI; `npm test` when touching covered areas.

### Android Build Variants

Two apps, distinct bundle IDs, coexist same device:

| | Dev | Prod |
|--|-----|------|
| **Script** | `npm run android:dev` | `npm run android` |
| **App name** | Keeper (Dev) | Keeper |
| **Bundle ID** | `com.clikethis123.keeper.dev` | `com.clikethis123.keeper` |
| **JS source** | Metro server (hot reload) | Bundled in APK |

`APP_VARIANT=development` env var `app.config.js` controls variant.
After `android:dev` once, daily dev: `npm start`.

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
   - `services/notes/` — `noteService.ts` (CRUD), `notesIndex.ts` (SQLite full-text search), `Notes.ts`/`Notes.web.ts` (platform FS abstraction)
   - `services/git/` — `gitService.ts` (batched commit queue), `gitInitializationService.ts` (clone/validate on launch), `gitApi.ts` (Octokit GitHub API)

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

Generated `ios/`, `android/` folders disposable; recreate with Expo prebuild/autolinking.

Runtime support:
- Supported: Tauri desktop, Android native build, iOS native build
- Unsupported (startup failure by design): web, Expo Go

## Scroll Management

Editor scrolling via `EditorScrollContext`.

### Environment Variables

```
EXPO_PUBLIC_GITHUB_OWNER=<owner>
EXPO_PUBLIC_GITHUB_REPO=<repo>
EXPO_PUBLIC_GITHUB_TOKEN=<token>
EXPO_PUBLIC_GIT_API_URL=<backend-url>   # optional remote backend
```

## Key Conventions

- **Expo CLI**: Before suggesting flags/options, verify Expo docs or `npx expo <command> --help`. Prefer idiomatic solutions (e.g., `BROWSER=none` suppress browser auto-open) over unverified flags.
- **Immutability**: `Document`, `BlockNode`, `Transaction` frozen. Never mutate directly.
- **Editor state**: All changes through `editorStore` actions — don't modify document state outside store.
- **Linting**: Biome (not ESLint/Prettier). Install Biome VS Code extension.
- **Platform splits**: `.web.ts` files override `.ts` counterpart on web (e.g., `Notes.web.ts`).
- **Testing**: `npm test` Jest suite (pure TS modules + selected RN UI routes/components); `npm run lint` Biome checks.
- **Startup profiling**: Use `[StartupTrace]` logs `docs/Startup telemetry.md` when investigating launch performance.

## Commit Conventions

Refer to @COMMIT_CONVENTIONS.md
