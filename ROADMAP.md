# Keeper Development Roadmap

This is the central planning document for Keeper. It outlines critical issues, development phases, and high-level features. Refer to this document before starting new work.

## Critical Issues (P1)

No currently confirmed P1 issues.

### Recently resolved
**Desktop hydration bug**: Fixed. Desktop now hydrates immediately on Tauri while note-loading hooks wait for storage initialization state before reading from disk, so restored editor routes no longer get stuck on the wrong backend.
**Key files**: `src/app/_layout.tsx`, `src/hooks/useLoadNote.ts`, `src/hooks/useNotes.ts`, `src/stores/storageStore.ts`

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
- Cross-block `ArrowUp` / `ArrowDown` navigation for paragraph, heading, list, math, and image blocks

**What remains next for keyboard work**:
- **Tier 2: Common block-editor shortcuts**
  - `Shift+Enter` — Soft line break within supported blocks
  - `Cmd/Ctrl+Enter` — Toggle checkbox state or complete current todo
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

### App Updates
**Issue**: Expo OTA (Over-The-Air) updates not working
**Impact**: Desktop/mobile app updates require full rebuild

### Wikilink Create Flow ✅
**Status**: Implemented in this workspace.
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
**Goals**:
- Sort notes by theme, priority, or relevance
- Auto-process notes into categories (recommendation system)
- Relevance signals: time, topic, relation to other notes

**Note types**:
- Journals (time-based)
- Resources (reference material)
- Todos (action items)

---

## Feature Backlog

### Archive Old Journals
Move old journal entries out of active workspace.

### Embedded Video Player
Watch YouTube (and other videos) while editing notes, without leaving the app.

### Tabs
- Being able to spawn new tabs
- Being able to pin existing tabs

**Layout**:
- Mobile: video panel above the note editor (stacked vertically)
- Desktop: video panel to the side of the editor (split view, horizontal)

**Scope**:
- YouTube URL detection or manual paste to open video panel
- Resizable/dismissible panel
- Playback controls visible while editing

**TODO**: Remove read-only view guards

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
