# git_core

Shared Rust Git core used by both Tauri commands and mobile native bridges.

## API

The crate exposes:

- `clone_repo(url, path)`
- `fetch(repo_path)`
- `checkout(repo_path, reference)`
- `current_branch(repo_path)`
- `list_branches(repo_path, remote)`
- `merge(repo_path, options)`
- `commit(repo_path, message)`
- `push(repo_path)`
- `status(repo_path)`
- `head_oid(repo_path)`
- `changed_markdown_paths(repo_path, from_oid, to_oid)`

It also exports C ABI symbols for mobile FFI:

- `clone_git`
- `git_fetch`
- `git_checkout`
- `git_current_branch_json`
- `git_list_branches_json`
- `git_merge_json`
- `git_commit`
- `git_push`
- `git_status_json`
- `git_head_oid_json`
- `git_changed_markdown_paths_json`

## Mobile Build Targets

### iOS

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
cargo build --manifest-path src-tauri/git_core/Cargo.toml --release --target aarch64-apple-ios
cargo build --manifest-path src-tauri/git_core/Cargo.toml --release --target aarch64-apple-ios-sim
cargo build --manifest-path src-tauri/git_core/Cargo.toml --release --target x86_64-apple-ios
```

### Android

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
cargo install cargo-ndk
cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 \
  build --manifest-path src-tauri/git_core/Cargo.toml --release
```

When developing mobile and desktop together, set `CARGO_TARGET_DIR` for the
mobile bridge build so Android artifacts do not land in
`src-tauri/git_core/target` and trigger `tauri dev` rebuilds.
