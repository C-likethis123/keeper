# PWA migration plan

## Goal

Ship Keeper as installable, offline-capable web app from shared Expo UI. Keep native and Tauri adapters until browser replacement proves parity.

## Decisions

- Browser local-first. Notes, binary assets, sync queue live on device first.
- Browser data uses IndexedDB. Do not depend on Tauri or device filesystem APIs.
- Sync server becomes authenticated and user-scoped before public release.
- Static Expo export stays deployment target. Host app and API on HTTPS domains.

## Work order

1. Foundation
   - Add web runtime detector.
   - Add IndexedDB `StorageEngine` for notes, assets, index records.
   - Keep existing Tauri storage engine when Tauri globals exist.
   - Replace browser-only Tauri file pickers with browser file input and Blob URLs.

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
   - Migrate existing local desktop notes through explicit export/import or authenticated first sync.

## Acceptance gates

- Fresh browser user can create/edit/search notes offline, close tab, reopen, and retain content.
- Attachments and images render after restart and offline.
- PWA installs on supported desktop and mobile browsers.
- No browser code invokes Tauri APIs.
- Anonymous or cross-user API access cannot read/write notes.
- `npm run lint`, relevant tests, and `npm run build:web` pass.

## Current implementation slice

Foundation only: browser storage, browser file import, manifest/service worker, browser startup smoke test. Authenticated public sync and full browser index parity remain release blockers; MOC classification is server-owned.
