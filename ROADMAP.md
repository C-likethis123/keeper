# Keeper Development Roadmap

This is the central planning document for Keeper. It outlines critical issues, development phases, and high-level features. Refer to this document before starting new work.

## Critical Issues (P1)

### [P1] Desktop Hydration Bug
**Impact**: Desktop app can permanently load editor from wrong backend
**Root cause**: In `_layout.tsx` (line 98), Tauri renders before `StorageInitializationService` finishes. `useLoadNote.ts` (line 10) only loads once per id. If app restores editor route on startup, NoteService.loadNote() runs against default expo-opfs backend, returns null, and never retries after storage init.
**Affected files**: `app/_layout.tsx`, `hooks/useLoadNote.ts`, `services/notes/`
**Fix**: Ensure storage backend selection completes before editor load, or implement retry logic on storage init completion.

### [P2] Desktop Title Escaping Regression
**Impact**: Quoted titles don't round-trip correctly
**Root cause**: `tauriStorage.ts` (line 67) manually escapes `"` as `\"`, but both JS and Rust parsers only strip surrounding quotes without unescaping YAML escapes. Title `He said "hi"` becomes `He said \"hi\"`.
**Affected files**: `services/storage/tauriStorage.ts`, `src-tauri/src/storage.rs`
**Fix**: Implement proper YAML unescaping in both JS and Rust parsers.

---

## Development Phases

### Phase 1: FTS5 Wikilink Relevance Ranking ✅ (In Progress)
Migrate to FTS5 full-text search with three-tier relevance ranking for wikilink autocomplete.

**Status**: Implementation underway (Task 1–4 partially complete)
**Objectives**:
- Migrate SQLite schema from standard search to FTS5 virtual table
- Implement migration infrastructure with atomicity guarantees
- Add relevance scoring: title matches (tier 1), content matches (tier 2), timestamp (tier 3)
- Update wikilink autocomplete to use ranked results

**Key files**:
- `services/notes/notesIndexDb.ts` — FTS5 schema and search
- `services/notes/notesIndex.ts` — Service layer
- `components/editor/wikilinks/useWikiLinks.ts` — Autocomplete integration

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
**Options**:
1. Change branching strategy (reduce checkout overhead)
2. Switch to lib2git (alternative git implementation)

### App Updates
**Issue**: Expo OTA (Over-The-Air) updates not working
**Impact**: Desktop/mobile app updates require full rebuild

### Android Prebuild Git Bridge
**TODO**: Evaluate replacing the current Android prebuild Git bridge wiring with a local Expo module so native registration survives `expo prebuild --clean` via autolinking instead of app-level generated source patches. iOS already uses the local Expo module path.

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

**Layout**:
- Mobile: video panel above the note editor (stacked vertically)
- Desktop: video panel to the side of the editor (split view, horizontal)

**Scope**:
- YouTube URL detection or manual paste to open video panel
- Resizable/dismissible panel
- Playback controls visible while editing

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
