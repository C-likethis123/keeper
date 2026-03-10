#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GIT_CORE_MANIFEST="$ROOT_DIR/src-tauri/git_core/Cargo.toml"
GIT_CORE_DIR="$ROOT_DIR/src-tauri/git_core"
ANDROID_OUTPUT_DIR="$ROOT_DIR/android/app/src/main/jniLibs"
IOS_OUTPUT_DIR="$ROOT_DIR/ios/native/rust"

MODE="${1:-all}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

ensure_rust_target() {
  local target="$1"
  if ! rustup target list --installed | grep -qx "$target"; then
    echo "Rust target not installed: $target" >&2
    exit 1
  fi
}

build_android() {
  require_cmd cargo-ndk
  ensure_rust_target aarch64-linux-android
  ensure_rust_target armv7-linux-androideabi
  ensure_rust_target x86_64-linux-android

  mkdir -p "$ANDROID_OUTPUT_DIR"
  (
    cd "$GIT_CORE_DIR"
    cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 \
      -o "$ANDROID_OUTPUT_DIR" \
      build --release
  )
}

build_ios() {
  local targets=(
    aarch64-apple-ios
    aarch64-apple-ios-sim
    x86_64-apple-ios
  )
  local simulator_target_found=0

  for target in "${targets[@]}"; do
    if rustup target list --installed | grep -qx "$target"; then
      if [[ "$target" == *sim || "$target" == x86_64-apple-ios ]]; then
        simulator_target_found=1
      fi
      cargo build --manifest-path "$GIT_CORE_MANIFEST" --release --target "$target"
      mkdir -p "$IOS_OUTPUT_DIR/$target"
      cp "$ROOT_DIR/src-tauri/git_core/target/$target/release/libgit_core.a" \
        "$IOS_OUTPUT_DIR/$target/libgit_core.a"
    fi
  done

  if [[ ! -f "$IOS_OUTPUT_DIR/aarch64-apple-ios/libgit_core.a" ]]; then
    echo "Missing iOS device artifact. Install the aarch64-apple-ios Rust target." >&2
    exit 1
  fi

  if [[ "$simulator_target_found" -eq 0 ]]; then
    echo "Missing iOS simulator artifact. Install aarch64-apple-ios-sim or x86_64-apple-ios." >&2
    exit 1
  fi
}

require_cmd cargo
require_cmd rustup

case "$MODE" in
  android)
    build_android
    ;;
  ios)
    build_ios
    ;;
  all)
    build_android
    build_ios
    ;;
  *)
    echo "Usage: $0 [android|ios|all]" >&2
    exit 1
    ;;
esac
