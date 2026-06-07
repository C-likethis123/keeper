# AGENTS.md

This file gives Codex guidance for this repo.
Use Serena MCP when searching code or applying code changes.

## Communication

Respond like a caveman. No articles. No filler. No pleasantries. Short. Direct. Code speaks.

## Commands

```bash
npm install              # Install dependencies
npm start                # Start Expo/Metro

# Web/Desktop
npm run web:desktop      # Start Expo web on port 8082 for Tauri
npm run desktop          # Start Tauri desktop
npm run desktop:dev      # Start Tauri desktop with dev config
npm run build:desktop    # Build production desktop app
npm run build:desktop:dev # Build dev desktop app bundle
npm run build:web        # Export Expo web build

# Mobile
npm run android          # Run Android via Expo
npm run ios              # Run iOS via Expo
npm run build:android    # Prebuild, build Rust bridge, install release APK
npm run build:mobile-git # Build Rust git bridge for mobile

# Utilities
npm test                 # Jest unit suite
npm run test:watch       # Jest watch mode
npm run lint             # Biome lint
npm run lint:fix         # Biome check --write
npm run knip             # Dependency/export check
npm run build:viewers    # Build PDF/EPUB viewer assets
```

Run `npm run lint` for CI-style checks. Run `npm test` when touching covered TypeScript, UI, services, or store logic. Run Cargo checks/tests when touching `src-tauri/*_core`.

## Architecture

Keeper is an Expo Router React Native note app for iOS, Android, web, and Tauri desktop. It stores Markdown notes on local storage, indexes metadata/search in SQLite, and syncs with Git/GitHub through Rust-backed engines.

### Source Root

Application TypeScript lives under `src/`. Old root-level `app/`, `components/`, `hooks/`, `services/`, and `stores/` paths are obsolete.

### Layers

1. **Routes** (`src/app/`) - Expo Router screens. `_layout.tsx` re-exports native layout. `_layout.native.tsx` handles mobile startup, drawer navigation, share intents, and toast overlay. `_layout.web.tsx` handles web/Tauri startup plus desktop close-time git flush. `index.tsx` is note grid. `editor.tsx` is editor. `suggested-mocs.tsx` shows MOC suggestions.

2. **Components** (`src/components/`) - UI layer. Core screens use `NoteGrid`, `NoteCard`, `HomeQuickComposer`, `HomeScreenHeader`, `NoteEditorView`, `NoteEditorHeader`, `TabBar`, drawers, modals, and shared UI in `src/components/shared/`.

3. **Editor** (`src/components/editor/`) - Markdown editing and attachment panes.
   - `DomEditor.tsx` wraps editor surface.
   - `lexical/` is canonical rich Markdown editor: toolbar, code blocks, slash commands, equations, images, tables, checklist transforms, wiki links, and Markdown transforms.
   - `slash-commands/` owns slash command overlay and trigger logic.
   - `wikilinks/` owns wiki link overlay utilities outside Lexical node/transformer code.
   - `document/`, `article/`, and `video/` render split panels and embedded PDF/EPUB/video experiences.
   - `core/` now only contains shared editor primitives such as `Selection` and pending dispatch registry. Do not reintroduce old block model or block renderer paths.

4. **State** (`src/stores/`) - Zustand stores:
   - `editorStore.ts` - current note/editor state and editor actions.
   - `filterStore.ts` - home filtering.
   - `storageStore.ts` and `storageSuspense.ts` - storage initialization state.
   - `tabStore.ts` - open note tabs.
   - `toastStore.ts` - toast notifications.

5. **Hooks** (`src/hooks/`) - App and screen behavior: startup, autosave, note loading, note listing, related notes, note creation/opening, keyboard shortcuts, share handling, layout, styles, debounce, and suspense loaders.

6. **Services** (`src/services/`) - Persistence and side effects:
   - `notes/` - note CRUD, frontmatter, note type derivation, templates, attachments/images, wiki link parsing, query cache, SQLite/index DB sync, cluster and cluster feedback services.
   - `git/` - Git service, sync manager, journal, async queue, native bridge, runtime engine selection, Rust engine, and repo init/reconcile services.
   - `storage/` - platform storage engine abstraction with mobile and Tauri engines.
   - `startup/` - startup steps, strategies, telemetry.
   - `app/` - reset app data service.
   - `toast.ts` - toast facade.

7. **Native/Rust**:
   - `modules/keeper-git/` - Expo native module for mobile Git bridge, Kotlin/Swift wrappers, Rust build script.
   - `src-tauri/src/` - Tauri app commands and desktop storage bridge.
   - `src-tauri/git_core/` - Rust Git core crate.
   - `src-tauri/storage_core/` - Rust SQLite/storage core crate and migrations.

8. **MOC Pipeline**:
   - `src/components/moc/` - UI for suggestions, related notes, cluster add/rename/merge.
   - `src/services/notes/clusterService*` and `clusterFeedbackService*` - app-side cluster data.
   - `scripts/moc_pipeline/` - Python clustering, embedding, feedback, learning, pipeline tests.

## Data Persistence

1. **Storage engine** - `src/services/storage/*` chooses mobile or Tauri storage implementation.
2. **Notes service** - `src/services/notes/noteService.ts` reads/writes Markdown and metadata.
3. **Index DB/SQLite** - `src/services/notes/indexDb/*`, `notesIndexDb*`, and migrations keep search, metadata, wiki links, clusters, and feedback queryable.
4. **Git sync** - `src/services/git/*` batches, journals, commits, reconciles, and flushes changes through Rust Git engine/native bridge.

## Key Conventions

- Use `@/` imports for `src/`.
- Keep editor work in Lexical plugins/nodes/transforms. Do not add legacy `UnifiedBlock` or `BlockRegistry` paths.
- Do not mutate editor state directly. Use store actions and immutable updates.
- Keep platform splits explicit: `.web.ts`, `.native.tsx`, and platform-specific services override shared files.
- Use storage and git engine abstractions. Do not call Tauri or native module APIs directly from UI.
- Use Biome, not ESLint/Prettier.
- Tests live beside code in `__tests__/` and use Jest/RNTL where relevant.
- Build-generated folders (`node_modules`, `android`, `ios`, `dist`, `src-tauri/target`) are not source of truth.

## Environment Variables

```bash
EXPO_PUBLIC_GITHUB_OWNER=<owner>
EXPO_PUBLIC_GITHUB_REPO=<repo>
EXPO_PUBLIC_GITHUB_TOKEN=<token>
EXPO_PUBLIC_GIT_API_URL=<backend-url> # optional remote backend
```
