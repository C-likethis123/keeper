# Rust Git Native Bridge Scaffold

This folder contains the React Native bridge scaffold for calling Rust `git_core` C ABI symbols.

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

## Android wiring (implemented)

Files:
- `android/app/src/main/java/com/clikethis123/keeper/KeeperGitBridgeModule.kt`
- `android/app/src/main/java/com/clikethis123/keeper/KeeperGitBridgePackage.kt`
- `android/app/src/main/java/com/clikethis123/keeper/MainApplication.kt` (manual package registration)

Expected native library:
- `libgit_core.so` loaded with `System.loadLibrary("git_core")`

Place `cargo-ndk` output under Android JNI libs path for each ABI, for example:
- `android/app/src/main/jniLibs/arm64-v8a/libgit_core.so`
- `android/app/src/main/jniLibs/armeabi-v7a/libgit_core.so`
- `android/app/src/main/jniLibs/x86_64/libgit_core.so`

## iOS integration (implemented in this repo)

Files are integrated into the app target:
- `ios/native/KeeperGitBridge.swift`
- `ios/native/KeeperGitBridge.m`
- `ios/native.xcodeproj/project.pbxproj` includes both source files, links `native/libgit_core.a`, and copies the correct prebuilt Rust archive into place during Xcode builds.

Build native artifacts with:
- `npm run build:mobile-git`

Bridge methods include:
- `clone`, `fetch`, `checkout`, `currentBranch`, `listBranches`, `merge`, `commit`, `push`, `status`
- `resolveHeadOid`
- `changedMarkdownPaths`
