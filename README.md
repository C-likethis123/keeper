# Keeper

Local-first Markdown notes for web/PWA.

## Tech stack

1. Vite, React, React Router, and shared HTML/CSS components
2. [Lexical](https://lexical.dev/) rich Markdown editor, rendered in browser DOM
3. Browser IndexedDB storage
4. Optional server sync for note operations, Git mirroring, and MOC classification

## Get started

1. Install dependencies

   ```bash
   npm install

   ```

2. Start development

   ```bash
   npm run vite
   ```

Useful commands:

- `npm run build:web` — build production Vite web/PWA bundle
- `npm run lint`, `npm test`, and `npm run test:browser` — checks

`npm test` runs source and browser suites with Vitest, jsdom, and DOM Testing Library.
Use `npm run test:watch` for watch mode or `npm test -- --project source` for shared source tests.

Shared source lives in `src/`; Vite browser source lives in `web/src/`.

### Web / PWA

Web is an installable local-first Vite PWA. Production builds include a manifest
and service worker; browser notes and attachments use IndexedDB.

Current release blockers: complete browser index/cluster parity; attachment quota UX; and cross-browser offline/update testing. See [`plans/pwa-migration.md`](plans/pwa-migration.md).

### Sync backend configuration

Configure sync server URL (`VITE_SYNC_SERVER_URL` or existing `EXPO_PUBLIC_SYNC_SERVER_URL`):

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

MOC classification belongs to server sync. When `EXPO_PUBLIC_SYNC_SERVER_URL` is configured, client cluster services read and update server-owned suggestions. Server workers run the Python embedding and clustering pipeline after sync work; clients review, accept, rename, dismiss, and organize returned clusters.

Server setup and operator details: [`server/README.md`](server/README.md) and [`docs/server-sync-cutover.md`](docs/server-sync-cutover.md). `scripts/moc_pipeline/` is server/development tooling, not normal client setup.

---

## Tooling
- Install the Biome VS Code extension and enable it for linting/formatting.
- In CI, run `npm run lint` to use Biome.
- For startup profiling, see `docs/Startup telemetry.md` for the `[StartupTrace]` log format and the main timing fields.
