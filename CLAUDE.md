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
   - `useShareHandler` — YouTube/URL share intent processing
   - `useRelatedNotes` — graph-based related notes

5. **Services** (`services/`) — Persistence:
   - `services/notes/` — `noteService` (CRUD), `notesIndex` (FTS5 search), `clusterService` (MOC suggestions), `attachmentStorage` (PDF/ePub), `imageStorage`, `wikiLinkParser`, `noteTypeDerivation`
   - `services/git/` — `gitService` (batched commits), `gitInitializationService`, `gitApi` (Octokit)
   - `services/startup/` — startup strategies and steps
   - `services/storage/` — storage initialization
   - `services/app/` — app events pub/sub

### Editor Model (`components/editor/core/`)

Immutable, transaction-based document model:
- `Document` — flat list of immutable `BlockNode`s with version
- `BlockNode` — type (paragraph, heading1-3, bullet/numbered/checkbox list, code, math, image, video, collapsible), content, attributes
- `Transaction` — atomic operations with `.inverse()` for undo
- `History` — undo/redo stack
- `EditorState` — selection state (block/gap selection)
- `EditorReducer` — pure function for all state changes

### Rendering

- `HybridEditor` — keyboard shortcuts, wiki link overlay, content sync
- `UnifiedBlock` — `TextInput` editing + `InlineMarkdown` preview
- `BlockRegistry` — `BlockType` → component mapping
- `EditorToolbar` — formatting commands, block insertion
- `BlockRow` — block rendering with selection gutters
- `EmbeddedVideoPanel` — video player with position persistence
- `DocumentPanel` — PDF/ePub viewer (PDF.js/epub.js)

### Data Persistence (three-tier)

1. **File system** via Rust git bridge
2. **SQLite** via `expo-sqlite` — FTS5 search index, wikilink graph, embeddings, clusters; rebuilt on git clone
3. **Git** via Rust `git_core` bridge — batched, debounced commits; optional GitHub push

### Key Features

- **MOC suggestions** — Python semantic clustering pipeline (sentence-transformers, scikit-learn) with GitHub Actions automation. Semantic clustering is handled in the repository that hosts the notes, while the Keeper app displays and manages the suggested semantic clusters
- **PDF/ePub split-screen** — attachments in `_attachments/`, resizable split panel
- **Video blocks** — YouTube and generic video with stacked/side layouts
- **YouTube sharing** — Android share intents + iOS extensions
- **Block/gap selection** — structured selection primitives with keyboard (`Ctrl+A`, arrows) and gutter targets
- **Collapsible blocks** — `<details>` sections with live conversion
- **Templates** — reusable templates as first-class note types
- **Note type derivation** — automatic type from title cues and body content heuristics
- **Related notes** — graph-based related notes via wikilink edges
- **Keyboard shortcuts** — centralized registry (editor + app-level)
- **Wikilinks** — exact-title resolution, create-on-miss, autocomplete

## Rust Git Runtime

Shared Rust git core `src-tauri/git_core` (`git2`/libgit2):
- Core API: clone, fetch, checkout, branches, merge, commit, push, status
- C ABI native bridges: `git_*` functions
- Tauri commands: `git_*_repo`
- Mobile native bridge: `modules/keeper-git` (Expo module)

TS abstraction: `GitEngine`, `RustGitEngine`

## Key Conventions

- **Immutability**: `Document`, `BlockNode`, `Transaction` frozen
- **Editor state**: All changes through `editorStore` actions
- **Platform splits**: `.web.ts` overrides `.ts` on web
- **Testing**: `npm test` (Jest + React Native Testing Library), `npm run lint` (Biome)
- **Linting**: Biome (not ESLint/Prettier)
