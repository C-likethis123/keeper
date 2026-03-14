#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
GIT_CORE_MANIFEST="$REPO_ROOT/src-tauri/git_core/Cargo.toml"
GIT_CORE_DIR="$REPO_ROOT/src-tauri/git_core"

MODE="${1:-}"
OUTPUT_DIR="${2:-}"

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
  local output_dir="$1"

  require_cmd cargo
  require_cmd rustup
  require_cmd cargo-ndk

  ensure_rust_target aarch64-linux-android
  ensure_rust_target armv7-linux-androideabi
  ensure_rust_target x86_64-linux-android

  mkdir -p "$output_dir"
  (
    cd "$GIT_CORE_DIR"
    cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 \
      -o "$output_dir" \
      build --release
  )
}

copy_ios_artifact() {
  local rust_target="$1"
  local platform_dir="$2"
  local arch_dir="$3"

  cargo build --manifest-path "$GIT_CORE_MANIFEST" --release --target "$rust_target"
  mkdir -p "$OUTPUT_DIR/$platform_dir-$arch_dir"
  cp "$GIT_CORE_DIR/target/$rust_target/release/libgit_core.a" \
    "$OUTPUT_DIR/$platform_dir-$arch_dir/libgit_core.a"
}

build_ios() {
  local output_dir="$1"
  OUTPUT_DIR="$output_dir"

  require_cmd cargo
  require_cmd rustup

  mkdir -p "$OUTPUT_DIR"

  case "${PLATFORM_NAME:-}" in
    iphoneos)
      ensure_rust_target aarch64-apple-ios
      copy_ios_artifact aarch64-apple-ios iphoneos "${CURRENT_ARCH:-arm64}"
      ;;
    iphonesimulator)
      if [[ "${CURRENT_ARCH:-arm64}" == "x86_64" ]]; then
        ensure_rust_target x86_64-apple-ios
        copy_ios_artifact x86_64-apple-ios iphonesimulator x86_64
      else
        ensure_rust_target aarch64-apple-ios-sim
        copy_ios_artifact aarch64-apple-ios-sim iphonesimulator arm64
      fi
      ;;
    *)
      ensure_rust_target aarch64-apple-ios
      ensure_rust_target aarch64-apple-ios-sim
      copy_ios_artifact aarch64-apple-ios iphoneos arm64
      copy_ios_artifact aarch64-apple-ios-sim iphonesimulator arm64
      if rustup target list --installed | grep -qx "x86_64-apple-ios"; then
        copy_ios_artifact x86_64-apple-ios iphonesimulator x86_64
      fi
      ;;
  esac
}

case "$MODE" in
  android)
    if [[ -z "$OUTPUT_DIR" ]]; then
      echo "Usage: $0 android <output-dir>" >&2
      exit 1
    fi
    build_android "$OUTPUT_DIR"
    ;;
  ios)
    if [[ -z "$OUTPUT_DIR" ]]; then
      echo "Usage: $0 ios <output-dir>" >&2
      exit 1
    fi
    build_ios "$OUTPUT_DIR"
    ;;
  *)
    echo "Usage: $0 <android|ios> <output-dir>" >&2
    exit 1
    ;;
esac
