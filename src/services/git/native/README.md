# Rust Git Native Module

Keeper's mobile Rust bridge now lives in the local Expo module at `modules/keeper-git`.

## JavaScript surface

- Module name: `KeeperGitBridge`
- JS access helper: `src/services/git/native/rustGitNativeModule.ts`

Methods exposed:
- `clone(url, path)`
- `fetch(repoPath)`
- `checkout(repoPath, reference, options)`
- `currentBranch(repoPath)`
- `listBranches(repoPath, remote?)`
- `merge(repoPath, options)`
- `commit(repoPath, message)`
- `push(repoPath)`
- `status(repoPath)`
- `resolveHeadOid(repoPath)`
- `changedMarkdownPaths(repoPath, fromOid, toOid)`

## Source of truth

- Expo module package: `modules/keeper-git`
- Android module class: `modules/keeper-git/android/src/main/java/com/clikethis123/keeper/KeeperGitBridgeModule.kt`
- iOS module class: `modules/keeper-git/ios/KeeperGitBridgeModule.swift`
- Rust build hook: `modules/keeper-git/scripts/build-rust.sh`

The generated `ios/` and `android/` app folders are no longer the source of truth for bridge wiring. `expo prebuild --clean` should recreate integration through Expo autolinking.

## Build behavior

- Android builds compile `libgit_core.so` into the module's generated JNI libs directory.
- iOS builds compile `libgit_core.a` into the module's generated Rust output directory and link it from the module pod target.
- `npm run build:mobile-git` triggers the same module-owned build script as a convenience command.
