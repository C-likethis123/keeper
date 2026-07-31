# keeper

This is a cross-platform rich-text editor, built on both mobile and desktop.

## Tech stack

1. [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app)
2. React Native
3. Server sync with local Markdown and SQLite persistence

## Get started

1. Install dependencies

   ```bash
   npm install

   ```

2. Build the production Android app

   ```bash
   npm run build:android
   ```

- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)

App source lives in `src/`. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

### Desktop (Tauri)

The web app can run in a desktop window via [Tauri](https://tauri.app/). Prerequisites: [Rust](https://rustup.rs/) and Xcode Command Line Tools (macOS: `xcode-select --install`).

- **Dev**: `npm run desktop` — starts the Expo web server on `http://localhost:8082` and opens the Tauri window.
- **Concurrent mobile + desktop dev**: desktop uses Expo web on `8082`, while mobile dev keeps Metro on `8081`.
- **Production build**: `npm run build:desktop` — exports the web bundle then builds the desktop app. Outputs are in `src-tauri/target/release/` (and bundle artifacts for your OS).

The first run may prompt for system permissions (e.g. macOS).

### Sync backend configuration

Configure the sync server URL:

```bash
EXPO_PUBLIC_SYNC_SERVER_URL=https://your-backend.example.com
```

## MOC Suggestions (semantic clustering)

Keeper can surface suggested Maps of Content (MOCs) by clustering your notes semantically. This requires a one-time Python setup and a manual pipeline run whenever you want fresh suggestions.

### First-time setup

```bash
cd scripts/moc_pipeline
pip install -r requirements.txt
```

The pipeline uses `sentence-transformers` and `scikit-learn`. A virtual environment is recommended:

```bash
python -m venv ../../mlx-env
source ../../mlx-env/bin/activate
pip install -r requirements.txt
```

### Running the pipeline

Point the script at your local notes directory (the root of your cloned git repo):

```bash
python scripts/moc_pipeline/pipeline.py /path/to/your/notes
```

This reads all `*.md` files, generates embeddings, clusters them, and writes `.moc_clusters.json` to your notes root. The next time you open the app, it imports the clusters automatically and shows a **Suggested MOCs** section on the home screen.

### How often to re-run

Re-run the pipeline whenever your notes have changed enough to warrant fresh suggestions — there is no automatic trigger. A reasonable cadence is after a significant batch of new or edited notes (e.g. weekly, or after adding 10+ notes). Each run recomputes embeddings for all notes from scratch.

```bash
python scripts/moc_pipeline/pipeline.py /path/to/your/notes
```

Then reopen (or background/foreground) the app to pick up the new `.moc_clusters.json`.

### Reviewing suggestions

On the home screen, each cluster card shows an auto-generated name and its member notes. You can:
- **Accept** — creates a real MOC note pre-populated with wiki links to all cluster members
- **Rename** — edit the suggested name before accepting (iOS/desktop; Android support is limited)
- **Dismiss** — hides the suggestion permanently

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
