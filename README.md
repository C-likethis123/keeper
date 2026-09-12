# Keeper

Local-first Markdown notes for iOS, Android, web/PWA, and Tauri desktop.

## Tech stack

1. [Expo](https://expo.dev), Expo Router, React Native, and React Native Web
2. [Lexical](https://lexical.dev/) rich Markdown editor, rendered through Expo DOM
3. Local storage: native/Tauri Markdown plus SQLite indexes; browser IndexedDB storage
4. Tauri 2 desktop shell
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

- `npm run build:android` — prebuild and install Android release
- `npm run ios` / `npm run android` — run native development builds
- `npm run build:web` — export static web/PWA bundle
- `npm run lint` and `npm test` — lint and unit suite

- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)

App source lives in `src/`. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

### Desktop (Tauri)

The web app can run in a desktop window via [Tauri](https://tauri.app/). Prerequisites: [Rust](https://rustup.rs/) and Xcode Command Line Tools (macOS: `xcode-select --install`).

- **Dev**: `npm run desktop` — starts the Expo web server on `http://localhost:8082` and opens the Tauri window.
- **Concurrent mobile + desktop dev**: desktop uses Expo web on `8082`, while mobile dev keeps Metro on `8081`.
- **Production build**: `npm run build:desktop` — exports the web bundle then builds the desktop app. Outputs are in `src-tauri/target/release/` (and bundle artifacts for your OS).

The first run may prompt for system permissions (e.g. macOS).

### Web / PWA

Web is an installable local-first direction, not yet full release parity. Production static exports include a manifest and service worker; browser notes and attachments use IndexedDB rather than Tauri or device filesystem APIs.

Current release blockers: complete browser index/cluster parity; attachment quota UX; and cross-browser offline/update testing. See [`plans/pwa-migration.md`](plans/pwa-migration.md).

### Sync backend configuration

Configure the sync server URL:

```bash
EXPO_PUBLIC_SYNC_SERVER_URL=https://keeper.example.com
```

For a Cloudflare Pages deployment without a custom domain, set this build
variable to `/api` and use the private Pages/Workers VPC proxy in
[`cloudflare/private-api-proxy/README.md`](cloudflare/private-api-proxy/README.md).
Do not put an API token in an `EXPO_PUBLIC_*` variable.

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
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
