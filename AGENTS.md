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
npm run build:android    # Prebuild and install release APK

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

Keeper is an Expo Router React Native note app for iOS, Android, web/PWA, and Tauri desktop. It stores Markdown notes locally, indexes metadata/search in SQLite or browser storage, and syncs note operations through the server when configured.

### Source Root

Application TypeScript lives under `src/`. Old root-level `app/`, `components/`, `hooks/`, `services/`, and `stores/` paths are obsolete.

### Layers

1. **Routes** (`src/app/`) - Expo Router screens. `_layout.tsx` re-exports native layout. `_layout.native.tsx` handles mobile startup, drawer navigation, share intents, and toast overlay. `_layout.web.tsx` handles web/Tauri startup plus desktop close-time git flush. `index.tsx` is note grid. `editor.tsx` is editor. `suggested-mocs.tsx` shows MOC suggestions.

2. **Components** (`src/components/`) - UI layer. Core screens use `NoteGrid`, `NoteCard`, `HomeQuickComposer`, `HomeScreenHeader`, `NoteEditorView`, `NoteEditorHeader`, `TabBar`, drawers, modals, and shared UI in `src/components/shared/`.

3. **Editor** (`src/components/editor/`) - Markdown editing and attachment panes.
   - `lexical/LexicalMarkdownEditor.tsx` is canonical DOM-backed rich Markdown editor.
   - `lexical/` owns toolbar, code blocks, slash commands, equations, images, tables, checklist transforms, wiki links, and Markdown transforms.
   - `lexical/slashCommand/` and `lexical/wikilinks/` own their overlays and trigger logic.
   - `document/` and `video/` render split panels and embedded PDF/EPUB/video experiences.
   - `core/` contains shared editor primitives such as pending dispatch registry. Do not reintroduce old block-model or block-renderer paths.

4. **State** (`src/stores/`) - Zustand stores:
   - `filterStore.ts` - home filtering.
   - `storageStore.ts` and `storageSuspense.ts` - storage initialization state.
   - `tabStore.ts` - open note tabs.
   - `toastStore.ts` - toast notifications.

5. **Hooks** (`src/hooks/`) - App and screen behavior: startup, autosave, note loading, note listing, related notes, note creation/opening, keyboard shortcuts, share handling, layout, styles, debounce, and suspense loaders.

6. **Services** (`src/services/`) - Persistence and side effects:
   - `notes/` - note CRUD, frontmatter, note type derivation, templates, attachments/images, wiki link parsing, query cache, SQLite/index DB sync, cluster and cluster feedback services.
   - `sync/` - server sync push/pull, operation queue, CRDT transport, and sync orchestration.
   - `storage/` - platform storage engine abstraction with native/Tauri and browser IndexedDB engines.
   - `startup/` - startup steps, strategies, telemetry.
   - `toast.ts` - toast facade.

7. **Native/Rust**:
   - `src-tauri/src/` - Tauri app commands and desktop storage bridge.
   - `src-tauri/storage_core/` - Rust SQLite/storage core crate and migrations.

8. **MOC classification**:
   - `src/components/moc/` - UI for suggestions, related notes, cluster add/rename/merge.
   - `src/services/notes/clusterService*`, `clusterFeedbackService*`, and `serverClusterClient.ts` - client access to server-owned clusters and feedback.
   - `server/api/src/workers/mocWorker.ts` runs the Python classifier. `scripts/moc_pipeline/` remains server/development tooling, not normal client workflow.

## Data Persistence

1. **Storage engine** - `src/services/storage/*` chooses native/Tauri or browser IndexedDB storage implementation.
2. **Notes service** - `src/services/notes/noteService.ts` reads/writes Markdown and metadata.
3. **Index DB/SQLite** - `src/services/notes/indexDb/*`, `notesIndexDb*`, and migrations keep search, metadata, wiki links, clusters, and feedback queryable.
4. **Server sync** - `src/services/sync/*` queues note operations and pushes/pulls them through the sync server.

## Key Conventions

- Use `@/` imports for `src/`.
- Keep editor work in Lexical extensions/nodes/transforms.
- Do not mutate editor state directly. Use store actions and immutable updates.
- Keep platform splits explicit: `.web.ts`, `.native.tsx`, and platform-specific services override shared files.
- Use storage and sync abstractions. Do not call Tauri or native module APIs directly from UI.
- Use Biome, not ESLint/Prettier.
- Tests live beside code in `__tests__/` and use Jest/RNTL where relevant.
- Build-generated folders (`node_modules`, `android`, `ios`, `dist`, `src-tauri/target`) are not source of truth.

## Environment Variables

```bash
EXPO_PUBLIC_SYNC_SERVER_URL=<sync-server-url>
```
