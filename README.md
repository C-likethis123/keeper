# keeper

This is a cross-platform rich-text editor, built on both mobile and desktop.

## Tech stack

1. [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app)
2. React Native
3. Git libraries (Rust `git_core` via Tauri/native bridge for local repositories, Octokit for the GitHub API)

## Get started

1. Install dependencies

   ```bash
   npm install

   rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
   rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
   cargo install cargo-ndk
   ```


2. Install Rust prerequisites for native mobile builds

   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
   rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
   cargo install cargo-ndk
   ```

3. Generate native projects and start the app

   ```bash
   npx expo prebuild --clean
   npm run android
   npm start
   ```

   The local Expo module in `modules/keeper-git` now owns the Rust bridge wiring for iOS and Android. Fresh native generation recreates the bridge automatically, and native builds compile the Rust library from `src-tauri/git_core` as needed. `npm run build:mobile-git` remains available as a convenience rebuild command.

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

### Desktop (Tauri)

The web app can run in a desktop window via [Tauri](https://tauri.app/). Prerequisites: [Rust](https://rustup.rs/) and Xcode Command Line Tools (macOS: `xcode-select --install`).

- **Dev**: `npm run desktop` — starts the Expo web server and opens the Tauri window (loads from `http://localhost:8081`).
- **Production build**: `npm run build:desktop` — exports the web bundle then builds the desktop app. Outputs are in `src-tauri/target/release/` (and bundle artifacts for your OS).

The first run may prompt for system permissions (e.g. macOS).

### Git backend configuration

The editor can send file change batches to a backend git service. Configure the backend URL via:

```bash
EXPO_PUBLIC_GIT_API_URL=https://your-backend.example.com/api
```

### Git runtime support

Git sync is Rust-only. Supported runtimes:
- Tauri desktop
- Android native build
- iOS native build

Unsupported runtimes fall back to local-only mode:
- Web
- Expo Go

## Tooling
- Install the Biome VS Code extension and enable it for linting/formatting.
- In CI, run `npm run lint` to use Biome.


## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
