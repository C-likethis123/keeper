# Keeper

Local-first Markdown notes for web/PWA.

## Tech stack

1. [Expo](https://expo.dev), Expo Router, React Native, and React Native Web
2. [Lexical](https://lexical.dev/) rich Markdown editor, rendered through Expo DOM
3. Browser IndexedDB storage
4. Optional server sync for note operations, Git mirroring, and MOC classification

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

- `npm run build:web` — export static web/PWA bundle
- `npm run lint` and `npm test` — lint and unit suite

App source lives in `src/`. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

### Web / PWA

Web is an installable local-first direction, not yet full release parity. Production static exports include a manifest and service worker; browser notes and attachments use IndexedDB.

Current release blockers: complete browser index/cluster parity; attachment quota UX; and cross-browser offline/update testing. See [`plans/pwa-migration.md`](plans/pwa-migration.md).

### Sync backend configuration

Configure the sync server URL:

```bash
EXPO_PUBLIC_SYNC_SERVER_URL=https://keeper.example.com
```

For this project's Cloudflare Worker deployment without a custom domain, build
with `npm run build:web:cloudflare`. It sets this value to `/api` and routes the
request through the private Workers VPC proxy in
[`cloudflare/private-api-proxy/README.md`](cloudflare/private-api-proxy/README.md).
Do not put an API token in an `EXPO_PUBLIC_*` variable.

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


## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Expo web guide](https://docs.expo.dev/workflow/web/): Learn Expo's web build and deployment workflow.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
