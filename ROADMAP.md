# Keeper Development Roadmap

This is the central planning document for Keeper. It outlines critical issues, development phases, and high-level features. Refer to this document before starting new work.

## Critical Issues (P1)

No currently confirmed P1 issues.

### Recently resolved

**Collapsible Section Support**: Implemented in this workspace. Users can now insert collapsible `<details>` sections via the toolbar or by typing `<details></details>` and pressing Enter. The feature includes a chevron indicator and dedicated summary/body zones in the editor.
**Key files**: `src/components/editor/blocks/LazyCollapsibleBlock.tsx`, `src/hooks/useToolbarActions.ts`, `src/components/editor/EditorToolbar.tsx`, `src/components/editor/blocks/BlockRegistry.tsx`

**Shared UI Components Refactor**: Extracted repeated UI patterns into shared components and hooks. Added `FilterChip`, `IconButton`, and the `useBlockInputHandlers` hook to unify behavior and reduce duplication across the editor and filters.
**Key files**: `src/components/shared/FilterChip.tsx`, `src/components/shared/IconButton.tsx`, `src/components/editor/blocks/useBlockInputHandlers.ts`

**Desktop hydration bug**: Fixed. Desktop now hydrates immediately on Tauri while note-loading hooks wait for storage initialization state before reading from disk, so restored editor routes no longer get stuck on the wrong backend.
**Key files**: `src/app/_layout.tsx`, `src/hooks/useLoadNote.ts`, `src/hooks/useNotes.ts`, `src/stores/storageStore.ts`

**Paragraph space insertion regression**: Fixed in this workspace. Paragraph blocks now fall back to native `TextInput` insertion for normal typing after manual cursor moves, while retaining markdown-trigger conversion only for explicit end-of-block trigger cases.
**Key files**: `src/components/editor/blocks/UnifiedBlock.tsx`, `src/components/editor/HybridEditor.tsx`, `src/components/editor/blocks/BlockRegistry.tsx`, `src/components/editor/BlockRow.tsx`

**Desktop note-list pagination regression**: Fixed in this workspace. Desktop note-list scrolling now loads additional notes again after the Tauri `index_list` command returned to a plain numeric cursor offset, and `NoteGrid` now has focused component coverage for load-more behavior.
**Key files**: `src/components/NoteGrid.tsx`, `src/components/__tests__/NoteGrid.jest.test.tsx`, `src-tauri/storage_core/src/lib.rs`

---

## Development Phases

### Phase 1: FTS5 Wikilink Relevance Ranking ✅

FTS5-backed note search and wikilink autocomplete are now in place on the shared notes index.

**Status**: Implemented
**Objectives**:

- Migrate SQLite schema from standard search to FTS5 virtual table
- Implement migration infrastructure with atomicity guarantees
- Add relevance scoring: title matches (tier 1), content matches (tier 2), timestamp (tier 3)
- Update wikilink autocomplete to use ranked results

**Key files**:

- `services/notes/notesIndexDb.ts` — FTS5 schema and search
- `services/notes/notesIndex.ts` — Service layer
- `components/editor/wikilinks/WikiLinkContext.tsx` — Autocomplete integration

---

### Phase 2: Image Blocks (Desktop-focused) ✅

Image attachment support is now available in the editor, including block rendering, attachment storage, and toolbar insertion.

**Status**: Implemented
**Notes**:

- Image blocks exist in the document model and renderer
- Picked images are copied into note storage and inserted as blocks
- Web still has a placeholder image-insert toolbar path

---

### Phase 3: Editor Keyboard Shortcut Foundation (Desktop + Web) ✅

A centralized keyboard shortcut system now exists for the editor instead of scattering shortcuts across individual block components.

**Status**: Implemented
**Shipped in this phase**:

- Central shortcut registry and command layer under `src/components/editor/keyboard/`
- Web/desktop `keydown` listener in `HybridEditor`
- `Cmd/Ctrl+Z` undo
- `Cmd+Shift+Z` redo on macOS plus `Ctrl+Y` / `Ctrl+Shift+Z` compatibility on non-mac layouts
- `Cmd/Ctrl+B` bold and `Cmd/Ctrl+I` italic inline formatting
- `Cmd/Ctrl+Alt/Option+1/2/3` heading shortcuts
- `Cmd/Ctrl+Shift+7/8/9` numbered-list, bullet-list, and checkbox-list shortcuts
- `Cmd/Ctrl+A` select-all-blocks command
- `Shift+Enter` soft line break insertion for supported text blocks
- `Tab` / `Shift+Tab` indent and outdent for list items
- `Escape` dismissal for wiki link UI
- `Backspace` / `Delete` for block-selection deletion
- `Cmd/Ctrl+Enter` toggle checkbox state for the focused checkbox block on web/desktop
- Cross-block `ArrowUp` / `ArrowDown` navigation for paragraph, heading, list, math, and image blocks

**Also shipped (app-level shortcuts)**:

- `Cmd/Ctrl+K` / `Cmd/Ctrl+P` — Focus search (both chords map to `focusSearch`)
- `Cmd/Ctrl+N` — New note
- `Cmd/Ctrl+S` — Force save / flush autosave
- Lightweight `appEvents` pub/sub system for cross-route shortcut dispatch
- `appShortcutRegistry` + `useAppKeyboardShortcuts` hook wired into the app layout and home/editor routes

**Key files**: `src/hooks/appShortcutRegistry.ts`, `src/hooks/useAppKeyboardShortcuts.ts`, `src/services/appEvents.ts`, `src/app/_layout.tsx`, `src/app/index.tsx`, `src/components/NoteEditorView.tsx`

**What remains next for keyboard work**:

- **Tier 2: Common block-editor shortcuts**
  - Better vertical caret preservation in complex blocks such as code blocks
  - Fix cursor selection stability during editor navigation and editing flows
  - Fix brace auto-completion behavior in code blocks
**Recommendation**:

- Keep editor-scoped shortcuts in the command registry
- Add future app-wide shortcuts at the app shell / route level rather than inside editor blocks

---

### Phase 4: Editor Core Test Foundation ✅

The first automated test slice is now in place for the immutable editor core.

**Status**: Implemented
**Shipped in this phase**:

- Added Jest coverage for the first pure TypeScript editor-core modules
- Added coverage for `Document` markdown parsing, serialization, numbered-list numbering, and empty-document invariants
- Added coverage for `Transaction` application, inverse generation, and builder metadata
- Added coverage for `History` undo/redo behavior, transaction grouping, and undo-stack trimming

**Key files**:

- `src/components/editor/core/__tests__/Document.test.ts`
- `src/components/editor/core/__tests__/Transaction.test.ts`
- `src/components/editor/core/__tests__/History.test.ts`
- `package.json`

**Why this phase first**:

- These modules are pure and deterministic, so they provide fast feedback without React Native rendering or native storage mocks
- They cover some of the riskiest editor invariants: markdown conversion, immutable state transitions, and undo/redo behavior

---

### Phase 5: Test Expansion for Editor State and Services

Build on the new editor-core test foundation by extending coverage into reducer/store behavior and pure service boundaries.

**Status**: Implemented
**Current implementation evidence**:

- Added reducer-level coverage for `EditorState` selection normalization, select-all, transaction application, and undo/redo restoration
- Added focused `editorStore` coverage for prepared-content invalidation, block-range deletion, split/merge behavior, and reset/history cleanup
- Added service-level coverage for notes frontmatter parsing/stringifying and startup-step rebuild/error handling
- Added Jest alias/config support so source modules can be exercised through their existing `@/` imports
**Objectives**:

- Add reducer-level tests for `EditorState`
- Add focused store tests for high-value `editorStore` behaviors that wrap reducer/history flows
- Add unit tests for pure notes and startup helpers where mocking cost stays low
- Keep the first test layers framework-light and avoid React rendering unless behavior requires it

**Candidate files**:

- `src/components/editor/core/EditorState.ts`
- `src/stores/editorStore.ts`
- `src/services/notes/frontmatter.ts`
- `src/services/startup/startupStrategies.ts`
- `src/services/startup/startupSteps.ts`
- `src/services/git/init/repoBootstrapper.ts`
- `src/components/editor/core/__tests__/EditorState.test.ts`
- `src/stores/__tests__/editorStore.test.ts`
- `src/services/notes/__tests__/frontmatter.test.ts`
- `src/services/startup/__tests__/startupSteps.test.ts`
- `src/services/git/init/__tests__/repoBootstrapper.test.ts`
- `jest.config.js`

**Follow-up**:

- Add coverage for `startupStrategies.ts` runtime sequencing and hydration ordering as the suite expands
- Add more `editorStore` flows gradually if regressions or repeated manual checks show the need
- Keep Phase 6 UI/integration work separate so this layer stays fast and deterministic

---

### Phase 6: Component and Integration Test Architecture ✅

Introduce a separate test layer for UI and integration behavior after the pure-core suite is stable.

**Status**: Implemented
**Current implementation evidence**:

- Added a `jest-expo` + React Native Testing Library harness for `*.jest.test.tsx`
- Added route-aware Jest coverage for `src/app/editor.tsx` via `renderRouter`
- Added home-screen route coverage for `src/app/index.tsx`, including quick-composer note creation, note-type filters, and title prefix pre-population for typed note creation
- Added `NoteEditorView` coverage for note loading, todo-status defaulting on save, read-only back-navigation behavior, and title-based note type detection
- Added unit coverage for `noteTypeDerivation` prefix rules across journal, todo, resource, template, and URL patterns
- Added focused component coverage for `NoteFiltersDropdown`
- Added `NoteGrid` component coverage for load-more triggering and duplicate end-reached suppression
- Added dedicated hook coverage for `useNotes` pagination, init gating, and in-flight refresh handling
- Added dedicated hook coverage for `useToolbarActions` command dispatch, checkbox conversion, and native image insertion behavior
- Added `BlockRow` seam coverage for numbered-list numbering and sticky video wrapper behavior
- Added wikilink modal and overlay coverage for search, create-option behavior, keyboard submission, cancellation, and result selection
- Added `HybridEditor` platform coverage for rendered wikilink activation on web, iOS, and Android, including open-existing and create-on-miss navigation flows
- Added `EditorToolbar` component coverage for undo/redo dispatch, list indent/outdent enablement, checkbox conversion, and native-vs-web image affordances
- Added `useAutoSave` hook coverage for idle dedupe, save success/error handling, unmount flush, and initial snapshot normalization
- Added `useLoadNote` hook coverage for pending startup, init failure, note-not-found, and thrown load-error paths
- Added startup UI/runtime coverage for `src/app/_layout.tsx`, `useAppStartup`, and `startupStrategies.ts`, including desktop/mobile hydration sequencing and unsupported-runtime behavior
**Objectives**:

- Use `jest-expo` with React Native Testing Library for component coverage
- Add integration coverage for `HybridEditor`, toolbar flows, and note-loading/save interactions
- Define a small shared test-fixture strategy for documents, notes, and storage adapters
- Separate pure unit tests from UI/integration runs so feedback stays fast

**Decisions**:

- React Native / Expo component tests should use `jest-expo` plus React Native Testing Library
**Follow-up**:

- How much storage and git behavior should be mocked versus exercised through higher-level service seams
- Expand `HybridEditor` integration coverage beyond wikilink activation into keyboard shortcuts, split/merge flows, block selection deletion, paragraph-space handling, and scroll/focus coordination
- Expand `EditorToolbar` coverage into formatting actions and block type changes
- Extend `useAutoSave` coverage into `SaveIndicator` state transitions if that UI becomes more coupled to the hook
- Add Wikilink UI/integration coverage for create flow, overlay results, keyboard selection, and dismissal
- Expand note-list coverage beyond the current index-route tests into broader `NoteGrid` loading, error, empty, populated, filter, and navigation states
- Add more `editorStore` flow coverage as regressions or repeated manual checks reveal weak spots

### Wikilink Follow-up

The wiki link flow now covers exact-title resolution, create-on-miss behavior, desktop/web activation helpers, and focused modal/overlay UI behavior, but full editor-level integration validation is still incomplete.

**Status**: Partially implemented
**Current implementation evidence**:

- Added shared wiki link resolution helpers for exact-match lookup and create-if-missing note creation
- Added unit coverage for normalization, existing-note resolution, create-on-miss behavior, and platform-specific activation rules
- Added component coverage for modal search, create-option rendering, keyboard submission, cancellation, and overlay selection behavior
- Added `HybridEditor` platform tests covering rendered wikilink activation, including modifier-key behavior on web and create-on-miss navigation on iOS/Android
- Editor follow-up work touched `NoteEditorView`, `HybridEditor`, and block rendering paths to support the newer activation flow
**Next**:

- Manually validate clickable wiki links on desktop, including the expected modifier-key behavior on web/Tauri
- Expand editor-level integration coverage beyond the current rendered-link activation tests into surrounding editing/navigation flows
- Confirm device behavior stays consistent across desktop and mobile surfaces

---

## Known Issues & Improvements

### App Startup Performance

**Current**: 5–7 seconds startup time
**Issue**: Slow due to git operations and checkout requirements
**Recent progress**: Startup orchestration now runs through a dedicated hook and runtime strategy/step modules instead of a single large effect in `RootLayout`.
**Diagnostics**: Structured startup timing logs now emit under the `[StartupTrace]` prefix. See `docs/Startup telemetry.md` for how to read hydration, storage, git, and index timing fields.
**Key files**: `src/app/_layout.tsx`, `src/hooks/useAppStartup.ts`, `src/services/startup/startupStrategies.ts`, `src/services/startup/startupSteps.ts`
**Options**:

1. Change branching strategy (reduce checkout overhead)
2. Switch to lib2git (alternative git implementation)

### Editor Typing Lag

**Status**: On hold
**Issue**: Typing lag is still tracked in `docs/PLAN-editor-typing-lag.md`, but planning for this workstream is paused and it should not be auto-selected for new work until reprioritized.
**Options**:

1. Install the storybook plugin from Github on performance metrics, isolate the note editor view as a storybook component and track the performance

### App Updates ✅

**Status**: Implemented
**Issue**: Expo OTA (Over-The-Air) updates are not a reliable near-term fit for this project
**Reason**: Keeper makes frequent major changes, including native-code changes, and OTA updates cannot cover builds that require new native binaries
**Impact**: Desktop/mobile app updates that include native changes still require full rebuilds, so this should not be auto-selected for active work until the native surface stabilizes

### Wikilink Create Flow ✅

**Status**: Implemented.
**Current**: Wikilink autocomplete now offers a create action for unmatched titles, inserts the `[[Title]]` link, and creates a stub note so the destination exists immediately.
**Affected files**: `src/components/editor/wikilinks/WikiLinkContext.tsx`, `src/components/editor/wikilinks/WikiLinkModal.tsx`, `src/components/editor/wikilinks/WikiLinkOverlay.tsx`
**Follow-up**: Validate the new create flow UX on device and keep the dropdown result model flexible for future wiki link actions.

### Mobile Native Git Bridge

**Status**: Implemented via the local Expo module in `modules/keeper-git`
**Notes**:

- Native registration now survives clean Expo prebuilds through autolinking
- Android and iOS share the same local module approach
- `npm run build:mobile-git` remains as a convenience rebuild path for the Rust library

### Note Organization & Relevance

**Status**: In progress
**Current implementation evidence**: note type and todo-status metadata are now persisted in frontmatter and storage indexes, editable in the note editor, filterable from the note list UI, and selectable from the home quick composer when creating new journal, resource, and todo entries. Template notes are now also persisted as first-class note types, indexed alongside other notes, and reusable from the editor's "Insert from template" flow. Note type is now derived automatically from title prefixes and lightweight content heuristics via `deriveNoteType`; checklist-heavy bodies fall into todos, link-heavy bodies fall into resources, and dated journal-style bodies can be categorized as journals even when the title is generic. `NoteEditorView` now persists those content-derived categories through autosave and explicit saves.
**Key files**: `src/services/notes/frontmatter.ts`, `src/services/notes/notesIndexDb.ts`, `src/services/notes/noteTypeDerivation.ts`, `src/components/NoteEditorView.tsx`, `src/components/NoteFiltersDropdown.tsx`, `src/components/HomeQuickComposer.tsx`, `src/app/index.tsx`, `src/hooks/useNotes.ts`, `src/migrations/003_add_note_metadata.ts`, `src-tauri/src/storage/migrations/v3_add_note_metadata.rs`
**Next**: validate migration/backfill behavior on existing notes, tune the content-based categorization heuristics against real notes, decide how metadata should affect default sorting/relevance, and add higher-level organization views beyond the current filters.

**Goals**:

- Sort notes by theme, priority, or relevance
- Auto-process notes into categories (recommendation system)
- Relevance signals: time, topic, relation to other notes
- Investigate grouping notes into sections and ranking notes within those sections using only local/on-device signals where possible

**Potential additions from note-taking reflections**:

- Add note-level metadata for note intent so journals, resources, and action notes can be organized differently without relying on folders alone
- Support lighter-weight organization than folders alone, such as index/MOC notes and optional Johnny.Decimal-style collections for related notes
- Add a "Now / Next / Notes" workflow view so active work, near-term follow-ups, and longer-lived reference notes are separated without duplicating content

**Note types**:

- Journals (time-based)
- Resources (reference material)
- Todos (action items)
- Templates (reusable note bodies)

### Testing Architecture

**Status**: In progress
**Current**: The project now uses Jest as the primary test runner, with `jest-expo` + React Native Testing Library covering both pure modules and UI/routes. Current coverage includes `Document`, `Transaction`, `History`, `EditorState`, selected `editorStore` flows, `frontmatter`, `repoBootstrapper`, startup-step orchestration plus `startupStrategies`, `noteTypeDerivation`, `src/app/editor.tsx`, `src/app/index.tsx`, `src/app/_layout.tsx`, `NoteEditorView`, `NoteFiltersDropdown`, `EditorToolbar`, `BlockRow`, focused `NoteGrid` pagination behavior, `useNotes`, `useToolbarActions`, `useAutoSave`, `useLoadNote`, `useAppStartup`, wikilink modal/overlay flows, and `HybridEditor` rendered-wikilink activation behavior across web/iOS/Android.
**Next**:

- Expand tests gradually into the remaining editor seams beyond the current `BlockRow` / toolbar / note-list slice rather than widening startup coverage first
- Add shared fixtures only where repetition appears, keeping early tests close to the modules they cover

**Current constraints**:

- UI/integration coverage is still partial even though the runner is now unified on Jest
- Native/mobile behavior still needs a different strategy than pure TypeScript modules

---

## Feature Backlog

### Archive Old Journals

Move old journal entries out of active workspace.

### Phase 7: Embedded Video Player ✅

Watch YouTube (and other videos) while editing notes, without leaving the app.

**Status**: Implemented
**Features**:
- Stacked (mobile) and side (desktop) split-screen layouts
- YouTube URL parsing and generic embed fallback
- Playback position persistence via AsyncStorage
- Resume from last watched position on re-open
- Flexible split resizing via UI controls
- Integrated position tracking (native WebView + Web iframe)

**Key files**:
- `src/components/editor/video/videoUtils.ts`: URL parsing and layout logic
- `src/components/editor/video/videoPositionStore.ts`: AsyncStorage-backed position storage
- `src/components/editor/video/EmbeddedVideoPanel.tsx`: Resizable video panel with time tracking
- `src/components/NoteEditorView.tsx`: Split-screen orchestration and persistence wiring

---

### Phase 8: Shared UI Components & Refactors ✅

Extract repeated UI patterns into shared components and hooks to reduce duplication and improve maintainability.

**Status**: Implemented
**Shipped in this phase**:
- Added `FilterChip` shared component with selected state
- Added `IconButton` shared component for the editor toolbar
- Extracted `useBlockInputHandlers` hook for shared focus/keypress/selection logic in complex blocks
- Migrated `NoteFiltersBar`, `NoteEditorView`, `EditorToolbar`, `ImageBlock`, and `VideoBlock` to the new shared elements
- Added Jest coverage for all new shared components and hooks

**Key files**:
- `src/components/shared/FilterChip.tsx`
- `src/components/shared/IconButton.tsx`
- `src/components/editor/blocks/useBlockInputHandlers.ts`
- `src/components/editor/EditorToolbar.tsx`

---

### Phase 9: Collapsible Blocks ✅

Add support for collapsible sections using the `<details>` HTML pattern, including live trigger conversion and toolbar integration.

**Status**: Implemented
**Current implementation evidence**:
- Added `CollapsibleBlock` type to the document model and block registry
- Broadened the `triggerPrefix` regex in `BlockRegistry` to match `<details></details>` and `<details open>` for live conversion
- Wired `handleInsertCollapsible` through `useToolbarActions`
- Added the `expand-more` (▾) button to `EditorToolbar`
- Added dedicated `CollapsibleBlock` rendering and editor interaction handling for summary/body focus, expand-collapse state, and Enter/backspace flows
- Added unit and integration coverage for trigger detection, toolbar insertion, document parsing/serialization, and collapsible editing behavior

**Key files**:
- `src/components/editor/blocks/BlockRegistry.tsx`
- `src/hooks/useToolbarActions.ts`
- `src/components/editor/EditorToolbar.tsx`
- `src/components/editor/blocks/CollapsibleBlock.tsx`
- `src/components/editor/__tests__/CollapsibleBlockIntegration.jest.test.tsx`

**Follow-up**:
- Manually smoke test the live conversion and toolbar insertion on device
- Finalize the layout and interaction polish for the collapsible block body and summary zones

---

### Phase 10: Extract Todos From Notes ✅

Turn inline `todo:` entries inside note blocks into first-class tracked todos that stay linked back to the originating note context.

**Status**: Implemented
**Current implementation evidence**:
- Typing `todo: ` in a block triggers conversion into a `[[TODO: ...]]` wikilink via `wikiLinkUtils.ts` (`makeTodoTitle` helper)
- `HybridEditor` strips the `todo: ` prefix when resolving existing todos while preserving the full `TODO: ` title for new-note creation
- Wikilink create-on-miss flow generates stub todo notes with the canonical `TODO: <text>` title format
- Todo lifecycle metadata (`createdAt`, `completedAt`) is persisted through frontmatter and storage mappers
- Automated test coverage exists in `HybridEditorWikilinkEditing.jest.test.tsx` for trigger conversion, exact-title resolution, and stub-note creation

**Key files**:
- `src/components/editor/wikilinks/wikiLinkUtils.ts`
- `src/components/editor/HybridEditor.tsx`
- `src/services/notes/frontmatter.ts`
- `src/services/notes/types.ts`
- `src/components/editor/__tests__/HybridEditorWikilinkEditing.jest.test.tsx`

---

### Phase 11: Local-First Note Sections and Ranking

Group notes into derived sections (Pinned → Recently Edited → MOC collections → All Notes) with graph-powered ranking, powered by the **GraphQLite** SQLite extension.

**Status**: In Progress
**Task file**: `tasks/002-investigate-local-note-sections-and-ranking.md`
**Grove workspace**: `codex-local-note-sec-15df` / branch `codex/local-note-sections-ranking`
**Design decisions**:
- **Sections are derived views**, not user-managed metadata: computed buckets (Recently Edited, Pinned) + MOC-style collections detected by degree centrality
- **Graph engine: [GraphQLite](https://github.com/colliery-io/graphqlite)** — MIT-licensed SQLite extension with Cypher queries and built-in algorithms (PageRank, Louvain, Dijkstra, BFS/DFS, degree centrality, connected components). Mature project with 252 stars, 17 releases, and Rust + Python bindings.
- **Mobile (expo-sqlite)**: Extension loaded via `loadExtensionAsync()` at database open. expo-sqlite supports this on iOS/Android/macOS/tvOS. Compiled `.dylib`/`.so` bundled as app assets per architecture.
- **Desktop (Tauri/Rust)**: `graphqlite` Rust crate registers functions at database open time. No dynamic loading needed — the extension is statically linked into the Tauri binary.
**Implementation plan** (7 steps):
1. Build and bundle GraphQLite extension for all platforms (iOS arm64, Android arm64-v8a + x86_64, macOS arm64 + x86_64, Linux x86_64) via Expo config plugin
2. Load extension at app startup: `loadExtensionAsync()` on mobile, Rust crate on Tauri
3. Add `modified` column to notes index (migration 004) — from frontmatter, with file `mtime` fallback
4. Sync note graph into GraphQLite at index time — notes as nodes, wikilinks as edges; incremental sync on content change
5. Add graph query functions via Cypher — backlinks, BFS neighborhood, MOC scores (degree centrality), orphans; PageRank reserved for future
6. Build sectioned note list in `useNotes` — Pinned → Recently Edited (7-day window) → MOC sections (notes with ≥3 outgoing links) → All Notes
7. Update `NoteGrid` to render sections with headers
**Key files**: `src/services/notes/notesIndexDb.ts`, `src/services/notes/notesIndex.ts`, `src/hooks/useNotes.ts`, `src/components/NoteGrid.tsx`, `src-tauri/Cargo.toml`, `src-tauri/src/storage/mod.rs`, `assets/graphqlite/`
**Risks**: Extension build complexity for mobile targets (highest risk — may need Makefile patches; fallback to CTEs on mobile if iOS compilation fails), dual data model sync overhead (mitigation: incremental sync via content hash), MOC detection threshold tuning

---

### Tabs

Use tabs to toggle between different views without leaving the current workspace context.

**Scope**:

- Toggle between different views with tabs
- Being able to spawn new tabs
- Being able to pin existing tabs

### Future Ideas from Google Keep

- Drawings (low priority)
- PDF viewer (Zotero-like)
- Fix code editor issues
- Logseq-style bottom toolbar
- Flashcards
- Backlinks

---

## iOS Support

iOS native support now comes from the local Expo module in `modules/keeper-git`. To build:

- Dev: `npm run ios` (requires Xcode + valid signing)

Dev/prod variants use the same `APP_VARIANT` pattern as Android (`com.clikethis123.keeper.dev` vs `com.clikethis123.keeper`).

---

## Architecture Notes

See `CLAUDE.md` for:

- Build commands and dependencies
- Editor model (Document, BlockNode, Transaction, History)
- State management (editorStore, toastStore)
- Data persistence (filesystem, SQLite, Git)
- Platform-specific implementations (web, iOS, Android, Tauri desktop)
