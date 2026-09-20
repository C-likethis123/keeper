# Keeper

Local-first Markdown notes for web/PWA and Tauri desktop.

## Tech stack

1. [Vite](https://vite.dev/) and React browser app
2. [Lexical](https://lexical.dev/) rich Markdown editor
3. Browser IndexedDB storage, attachments, clipboard, and downloads
4. Tauri 2 desktop shell, isolated behind the browser/desktop service boundary
5. Optional server sync for note operations, Git mirroring, and MOC classification

## Get started

1. Install dependencies

   ```bash
   npm install

   ```

2. Start development

   ```bash
   npm start
   ```

Useful commands:

- `npm run build:web` — build static web/PWA bundle into `dist/`
- `npm run lint` and `npm test` — lint and unit suite

Browser source lives in `web/src/`. Routes use React Router.

### Desktop (Tauri)

The web app can run in a desktop window via [Tauri](https://tauri.app/). Prerequisites: [Rust](https://rustup.rs/) and Xcode Command Line Tools (macOS: `xcode-select --install`).

- **Dev**: `npm run desktop` — starts Vite on `http://localhost:8082` and opens the Tauri window.
- **Concurrent PWA + desktop dev**: desktop uses Vite on `8082`; use `npm start` for the PWA dev server.
- **Production build**: `npm run build:desktop` — builds the Vite bundle then builds the desktop app. Outputs are in `src-tauri/target/release/` (and bundle artifacts for your OS).

The first run may prompt for system permissions (e.g. macOS).

### Web / PWA

Web is an installable local-first direction, not yet full release parity. Production static exports include a manifest and service worker; browser notes and attachments use IndexedDB rather than Tauri or device filesystem APIs.

Current release blockers: complete browser index/cluster parity; attachment quota UX; and cross-browser offline/update testing. See [`plans/pwa-migration.md`](plans/pwa-migration.md).

### Sync backend configuration

Configure the sync server URL:

```bash
VITE_SYNC_SERVER_URL=https://keeper.example.com
```

For this project's Cloudflare Worker deployment without a custom domain, build
with `npm run build:web:cloudflare`. It sets this value to `/api` and routes the
request through the private Workers VPC proxy in
[`cloudflare/private-api-proxy/README.md`](cloudflare/private-api-proxy/README.md).
Do not put an API token in a `VITE_*` variable.

Cloudflare Worker configuration is checked in under `wrangler.jsonc` and
`cloudflare/private-api-proxy/wrangler.jsonc`. Use Wrangler-backed commands for
Cloudflare Worker changes:

```bash
npm run build:web:cloudflare
npm run deploy:web:cloudflare
```

Cloudflare Access policies are managed separately through Cloudflare's dashboard,
API, or Terraform; Wrangler does not manage them.

## MOC Suggestions

MOC classification belongs to server sync. When `VITE_SYNC_SERVER_URL` is configured, client cluster services read and update server-owned suggestions. Server workers run the Python embedding and clustering pipeline after sync work; clients review, accept, rename, dismiss, and organize returned clusters.

Server setup and operator details: [`server/README.md`](server/README.md) and [`docs/server-sync-cutover.md`](docs/server-sync-cutover.md). `scripts/moc_pipeline/` is server/development tooling, not normal client setup.

---

## Tooling
- Install the Biome VS Code extension and enable it for linting/formatting.
- In CI, run `npm run lint` to use Biome.
- For startup profiling, see `docs/Startup telemetry.md` for the `[StartupTrace]` log format and the main timing fields.

