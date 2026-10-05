# AGENTS.md

This file gives Codex guidance for this repo.
Use Serena MCP when searching code or applying code changes.

## Communication

Respond like a caveman. No articles. No filler. No pleasantries. Short. Direct. Code speaks.

## Commands

```bash
npm install              # Install dependencies
npm start                # Start Vite dev server

# Web
npm run build:web        # Build Vite web/PWA bundle
npm run build:web:cloudflare # Export web bundle for Cloudflare Worker
npm run deploy:web:cloudflare # Build and deploy web Worker with Wrangler

# Utilities
npm test                 # Vitest source + browser suites
npm run test:watch       # Vitest watch mode
npm run lint             # Biome lint
npm run lint:fix         # Biome check --write
npm run knip             # Dependency/export check
npm run build:viewers    # Build PDF/EPUB viewer assets
```

Run `npm run lint` for CI-style checks. Run `npm test` when touching covered TypeScript, UI, services, or store logic.

## Cloudflare

- Use Wrangler for Cloudflare Worker, static asset, binding, route, and deployment changes. Worker configuration lives in `wrangler.jsonc`; private API proxy configuration lives in `cloudflare/private-api-proxy/wrangler.jsonc`.
- Use `npm run deploy:web:cloudflare` for production web deploys. It builds the `dist/` bundle, then runs `wrangler deploy`.
- Do not make Cloudflare Worker configuration changes only in the dashboard. Keep configuration in the Wrangler files.
- Cloudflare Access policies are not managed by Wrangler. Use the Cloudflare dashboard, API, or Terraform for Access policy changes.

## Architecture

Keeper is an Vite React DOM note app for web/PWA. It stores Markdown notes and indexes metadata/search in browser storage, then syncs note operations through the server when configured.

### Source Root

Shared TypeScript lives under `src/`; browser routes and adapters live under `web/src/`. Old root-level `app/`, `components/`, `hooks/`, `services/`, and `stores/` paths are obsolete.

### Layers

1. **Routes** (`web/src/`) - React Router routes in `App.tsx` and `routes/`. `main.tsx` configures browser startup and service-worker registration; browser editor adapters live in `adapters/browser/editor/`.

2. **Components** (`src/components/`) - UI layer. Core screens use `NoteGrid`, `NoteCard`, `HomeQuickComposer`, `HomeScreenHeader`, `NoteEditorHeader`, drawers, modals, and shared UI in `src/components/shared/`.

3. **Editor** (`src/components/editor/`) - Markdown editing and attachment panes.
   - `lexical/LexicalMarkdownEditor.tsx` is canonical DOM-backed rich Markdown editor.
   - `lexical/` owns toolbar, code blocks, slash commands, equations, images, tables, checklist transforms, wiki links, and Markdown transforms.
   - `lexical/slashCommand/` and `lexical/wikilinks/` own their overlays and trigger logic.
   - `document/` and `video/` render split panels and embedded PDF/EPUB/video experiences.
   - `core/` contains shared editor primitives such as pending dispatch registry. Do not reintroduce old block-model or block-renderer paths.

4. **State** (`src/stores/`) - Zustand stores:
   - `filterStore.ts` - home filtering.
   - `storageStore.ts` - storage initialization state.
   - `tabStore.ts` - open note tabs.
   - `toastStore.ts` - toast notifications.

5. **Hooks** (`src/hooks/`) - App and screen behavior: startup, autosave, note loading, note listing, related notes, note creation/opening, keyboard shortcuts, layout and styles.

6. **Services** (`src/services/`) - Persistence and side effects:
   - `notes/` - note CRUD, frontmatter, note type derivation, templates, attachments/images, wiki link parsing, index DB sync, cluster and cluster feedback services.
   - `sync/` - server sync push/pull, operation queue, CRDT transport, and sync orchestration.
   - `storage/` - storage engine abstraction with browser IndexedDB and memory engines.
   - `startup/` - startup steps, strategies, telemetry.
   - `toast.ts` - toast facade.

7. **MOC classification**:
   - `src/components/moc/` - UI for suggestions, related notes, cluster add/rename/merge.
   - `src/services/notes/clusterService*`, `clusterFeedbackService*`, and `serverClusterClient.ts` - client access to server-owned clusters and feedback.
   - `server/api/src/workers/mocWorker.ts` runs the Python classifier. `scripts/moc_pipeline/` remains server/development tooling, not normal client workflow.

## Data Persistence

1. **Storage engine** - `src/services/storage/*` provides browser IndexedDB storage with memory fallback.
2. **Notes service** - `src/services/notes/noteService.ts` reads/writes Markdown and metadata.
3. **Index DB/SQLite** - `src/services/notes/indexDb/*`, `notesIndexDb*`, and migrations keep search, metadata, wiki links, clusters, and feedback queryable.
4. **Server sync** - `src/services/sync/*` queues note operations and pushes/pulls them through the sync server.

## Key Conventions

- Use `@/` imports for `src/`.
- Keep editor work in Lexical extensions/nodes/transforms.
- Do not mutate editor state directly. Use store actions and immutable updates.
- Use plain `.ts`/`.tsx` filenames. Browser adapters stay under `web/src/adapters/browser/`.
- Use storage and sync abstractions from UI.
- Use Biome, not ESLint/Prettier.
- Tests live beside code in `__tests__/` and use Vitest and DOM Testing Library where relevant.
- Build-generated folders (`node_modules`, `dist`) are not source of truth.

## Environment Variables

```bash
EXPO_PUBLIC_SYNC_SERVER_URL=<sync-server-url>
```
