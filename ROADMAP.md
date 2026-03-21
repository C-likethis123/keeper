# Keeper Development Roadmap

This is the central planning document for Keeper. It outlines critical issues, development phases, and high-level features. Refer to this document before starting new work.

## Critical Issues (P1)

No currently confirmed P1 issues.

### Recently resolved

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
- `Cmd/Ctrl+A` select-all-blocks command
- `Tab` / `Shift+Tab` indent and outdent for list items
- `Escape` dismissal for wiki link UI
- `Backspace` / `Delete` for block-selection deletion
- `Cmd/Ctrl+Enter` toggle checkbox state for the focused checkbox block on web/desktop
- Cross-block `ArrowUp` / `ArrowDown` navigation for paragraph, heading, list, math, and image blocks

**What remains next for keyboard work**:

- **Tier 2: Common block-editor shortcuts**
  - `Shift+Enter` — Soft line break within supported blocks
  - Better vertical caret preservation in complex blocks such as code blocks
- **Tier 3: Formatting shortcuts**
  - `Cmd/Ctrl+B` — Bold
  - `Cmd/Ctrl+I` — Italic
  - `Cmd/Ctrl+Alt/Option+1/2/3` — Heading shortcuts
  - `Cmd/Ctrl+Shift+7/8/9` — List type shortcuts
- **Tier 4: App-level productivity shortcuts**
  - `Cmd/Ctrl+K` — Focus search
  - `Cmd/Ctrl+N` — New note
  - `Cmd/Ctrl+P` — Quick switcher
  - `Cmd/Ctrl+S` — Force save / flush autosave

**Recommendation**:

- Keep editor-scoped shortcuts in the command registry
- Add future app-wide shortcuts at the app shell / route level rather than inside editor blocks

---

### Phase 4: Editor Core Test Foundation ✅

The first automated test slice is now in place for the immutable editor core.

**Status**: Implemented
**Shipped in this phase**:

- Added `vitest` as the initial unit test runner for pure TypeScript modules
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
- Added a lightweight `vitest` alias config so source modules can be exercised through their existing `@/` imports
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
- `src/components/editor/core/__tests__/EditorState.test.ts`
- `src/stores/__tests__/editorStore.test.ts`
- `src/services/notes/__tests__/frontmatter.test.ts`
- `src/services/startup/__tests__/startupSteps.test.ts`
- `vitest.config.ts`

**Follow-up**:

- Add coverage for `startupStrategies.ts` runtime sequencing and hydration ordering as the suite expands
- Add more `editorStore` flows gradually if regressions or repeated manual checks show the need
- Keep Phase 6 UI/integration work separate so this layer stays fast and deterministic

---

### Phase 6: Component and Integration Test Architecture

Introduce a separate test layer for UI and integration behavior after the pure-core suite is stable.

**Status**: In progress
**Current implementation evidence**:

- Added a `jest-expo` + React Native Testing Library harness for `*.jest.test.tsx`
- Added route-aware Jest coverage for `src/app/editor.tsx` via `renderRouter`
- Added `NoteEditorView` coverage for note loading, todo-status defaulting on save, and read-only back-navigation behavior
- Added `NoteGrid` component coverage for load-more triggering and duplicate end-reached suppression
**Objectives**:

- Use `jest-expo` with React Native Testing Library for component coverage
- Add integration coverage for `HybridEditor`, toolbar flows, and note-loading/save interactions
- Define a small shared test-fixture strategy for documents, notes, and storage adapters
- Separate pure unit tests from UI/integration runs so feedback stays fast

**Decisions**:

- React Native / Expo component tests should use `jest-expo` plus React Native Testing Library
**Follow-up**:

- Add a TODO to migrate the remaining `vitest` suites to `jest` over time for test-runner consistency
- How much storage and git behavior should be mocked versus exercised through higher-level service seams
- Add `HybridEditor` integration coverage for keyboard shortcuts, split/merge flows, block selection deletion, paragraph-space handling, and scroll/focus coordination
- Add `EditorToolbar` coverage for formatting actions, block type changes, and disabled/read-only behavior
- Add `useAutoSave` coverage for idle timing, save dedupe, error handling, and `SaveIndicator` state transitions
- Add `useLoadNote` hook coverage for pending, failed init, note-not-found, and thrown-error paths
- Add startup UI/integration coverage for `src/app/_layout.tsx`, `useAppStartup`, and `startupStrategies.ts`
- Add Wikilink UI/integration coverage for create flow, overlay results, keyboard selection, and dismissal
- Add note-list route coverage for `src/app/index.tsx` plus broader `NoteGrid` loading, error, empty, populated, filter, and navigation states
- Add more `editorStore` flow coverage as regressions or repeated manual checks reveal weak spots

### Wikilink Follow-up

The wiki link flow now covers exact-title resolution, create-on-miss behavior, and desktop/web activation helpers, but end-to-end UI validation is still incomplete.

**Status**: Partially implemented
**Current implementation evidence**:

- Added shared wiki link resolution helpers for exact-match lookup and create-if-missing note creation
- Added unit coverage for normalization, existing-note resolution, create-on-miss behavior, and platform-specific activation rules
- Editor follow-up work touched `NoteEditorView`, `HybridEditor`, and block rendering paths to support the newer activation flow
**Next**:

- Manually validate clickable wiki links on desktop, including the expected modifier-key behavior on web/Tauri
- Add component/integration coverage for wiki link activation, overlay selection, and navigation after note creation
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

### App Updates

**Issue**: Expo OTA (Over-The-Air) updates not working
**Impact**: Desktop/mobile app updates require full rebuild

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
**Current implementation evidence**: note type and todo-status metadata are now persisted in frontmatter and storage indexes, editable in the note editor, and filterable from the note list UI.
**Key files**: `src/services/notes/frontmatter.ts`, `src/services/notes/notesIndexDb.ts`, `src/components/NoteEditorView.tsx`, `src/components/NoteFiltersBar.tsx`, `src/hooks/useNotes.ts`, `src/migrations/003_add_note_metadata.ts`, `src-tauri/src/storage/migrations/v3_add_note_metadata.rs`
**Next**: validate migration/backfill behavior on existing notes, decide how metadata should affect default sorting/relevance, and add higher-level organization views beyond the current filters.

**Goals**:

- Sort notes by theme, priority, or relevance
- Auto-process notes into categories (recommendation system)
- Relevance signals: time, topic, relation to other notes

**Potential additions from note-taking reflections**:

- Add note-level metadata for note intent so journals, resources, and action notes can be organized differently without relying on folders alone
- Support lighter-weight organization than folders alone, such as index/MOC notes and optional Johnny.Decimal-style collections for related notes
- Add a "Now / Next / Notes" workflow view so active work, near-term follow-ups, and longer-lived reference notes are separated without duplicating content

**Note types**:

- Journals (time-based)
- Resources (reference material)
- Todos (action items)

### Testing Architecture

**Status**: In progress
**Current**: The project now has a `vitest` setup with passing coverage for `Document`, `Transaction`, `History`, `EditorState`, selected `editorStore` flows, `frontmatter`, and startup-step orchestration.
**Next**:

- Expand tests gradually into remaining startup/runtime seams, especially `startupStrategies`, as follow-on work rather than a prerequisite for this phase
- Decide on the component/integration testing stack for Expo/React Native surfaces
- Add shared fixtures only where repetition appears, keeping early tests close to the modules they cover

**Current constraints**:

- No pre-existing automated test suite beyond lint
- Native/mobile behavior still needs a different strategy than pure TypeScript modules

---

## Feature Backlog

### Archive Old Journals

Move old journal entries out of active workspace.

### Embedded Video Player

Watch YouTube (and other videos) while editing notes, without leaving the app.

**Layout**:

- Mobile: video panel above the note editor (stacked vertically)
- Desktop: video panel to the side of the editor (split view, horizontal)

**Scope**:

- YouTube URL detection or manual paste to open video panel
- Resizable/dismissible panel
- Playback controls visible while editing

**TODO**: Remove read-only view guards

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
- Prod: `eas build --platform ios --profile production`

Dev/prod variants use the same `APP_VARIANT` pattern as Android (`com.clikethis123.keeper.dev` vs `com.clikethis123.keeper`).

---

## Architecture Notes

See `CLAUDE.md` for:

- Build commands and dependencies
- Editor model (Document, BlockNode, Transaction, History)
- State management (editorStore, toastStore)
- Data persistence (filesystem, SQLite, Git)
- Platform-specific implementations (web, iOS, Android, Tauri desktop)
