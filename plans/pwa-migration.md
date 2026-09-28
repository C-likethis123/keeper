# PWA migration plan

## Goal

Ship Keeper as installable, offline-capable web app from shared Expo UI. Keep current Expo PWA working until Vite proves parity.

## Decisions

- Browser local-first. Notes, binary assets, sync queue live on device first.
- Browser data uses IndexedDB. Do not depend on device filesystem APIs.
- Sync server becomes authenticated and user-scoped before public release.
- Static Expo export stays deployment target. Host app and API on HTTPS domains.

## Work order

1. Foundation
   - Add IndexedDB `StorageEngine` for notes, assets, index records.
   - Use browser file input and Blob URLs for attachment import and display.

2. Install and offline
   - Add manifest, 192/512 icons, theme metadata.
   - Add versioned service worker. Precache build assets. Runtime-cache same-origin assets only.
   - Define update behavior: install new worker, prompt/reload only when no editor changes remain.

3. Browser parity
   - Implement browser index/backlinks persistence. Use server cluster APIs for MOC suggestions when server sync is configured; do not run client-side MOC classification.
   - Test note CRUD, images, PDF/EPUB import, drawing, history, full-text search, offline restart.
   - Establish attachment size limits and quota/error UI.

4. Public sync safety
   - Add account authentication, user ownership, authorization checks, token storage/refresh, and logout.
   - Scope every sync operation, cluster, attachment, and Git action by user/vault.
   - Allow only production/preview web origins through CORS.
   - Add API integration tests for cross-user isolation.

5. Delivery
   - Production export, deploy over HTTPS, and configure immutable cache headers for hashed bundles.
   - Run install/offline/update test matrix on Chrome, Safari macOS, Safari iOS, Android Chrome.
   - Persist Vite notes directly through the canonical browser storage engine.
   - Persist Vite images, clipboard images, PDF/EPUB attachments, and
     sync-downloaded attachment bytes through the canonical browser storage
     engine.
   - Persist Vite note history, sync device ID, pull cursor, and queued
     operations through canonical history and sync-state services.

## Acceptance gates

- Fresh browser user can create/edit/search notes offline, close tab, reopen, and retain content.
- Attachments and images render after restart and offline.
- PWA installs on supported desktop and mobile browsers.
- No browser code invokes removed desktop APIs.
- Anonymous or cross-user API access cannot read/write notes.
- `npm run lint`, relevant tests, and `npm run build:web` pass.

## Completed migration slices

- Removed Tauri desktop support.
- Persisted Vite notes through the canonical browser storage engine.
- Persisted Vite media through canonical `assets/...` and `_attachments/...`
  paths, including sync-downloaded attachment bytes.
- Persisted Vite history and sync state through canonical source services and
  the canonical browser storage engine.
- Ported Vite shell and home route to canonical theme, filters, toast and tab
  stores, keyboard shortcuts, home header, quick composer, note grid, note
  cards, and shared loading/error/empty UI. React Router remains the browser
  navigation boundary; Expo routes remain available.
- Added Vite-owned `manifest.webmanifest`, install metadata, reusable emitted
  192px/512px icons, and production-only service-worker registration.
- Added build-generated, content-versioned Vite precache from actual Rollup
  output. Vite worker keeps API, auth, sync, cluster, cross-origin, non-GET,
  redirect, opaque, and failed responses outside caches. Expo manifest and
  worker remain separate and unchanged.
- Added network-first navigation with offline application-shell fallback,
  immutable asset caching, obsolete Vite-cache cleanup, IndexedDB note/edit
  restart coverage, queued offline sync coverage, reconnect sync trigger
  coverage, offline local PDF coverage, and unknown-route shell fallback.
- Added explicit waiting-worker update state. Dirty editor blocks worker
  activation and reload; clean editor can explicitly apply update. Worker does
  not call `skipWaiting()` during install.

## Vite PWA status

- Manifest: generated build emits Vite manifest and icons under `web/dist`.
- Offline: automated Chromium coverage verifies shell, persisted notes, edits,
  queued operations, reconnect trigger, local PDF, and deep-link fallback.
- Updates: unit coverage verifies waiting state, explicit clean update, and
  dirty-editor deferral. Browser update replacement remains manual because
  test build serves one worker version.
- Install UI: prompt capture, dismissal, standalone detection, and unsupported
  browser instructions have unit coverage.
- Cloudflare: production build/deploy still uses Expo. No cutover performed.

## Manual install/update matrix

Not yet verified:

- Chrome desktop: install prompt/menu, standalone launch, dirty-update guard,
  explicit update, offline restart.
- Safari macOS: Add to Dock, standalone launch, offline restart, relaunch update.
- Safari iOS: Share → Add to Home Screen, icon/status bar, offline notes/editing.
- Android Chrome: install prompt/menu, standalone launch, offline restart,
  reconnect sync.

No maskable icon is declared. Existing icon assets have not been validated as
mask-safe across launchers.

Migration remains incomplete. Cloudflare still builds Expo. Production smoke
testing, manual install matrix, Cloudflare Vite cutover, and
Expo/React Native/Metro/Jest Expo removal remain unfinished.
