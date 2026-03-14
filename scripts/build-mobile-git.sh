#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODULE_DIR="$ROOT_DIR/modules/keeper-git"
MODULE_SCRIPT="$MODULE_DIR/scripts/build-rust.sh"
ANDROID_OUTPUT_DIR="$MODULE_DIR/android/build/generated/rust/jniLibs"
IOS_OUTPUT_DIR="$MODULE_DIR/ios/rust/ios"

MODE="${1:-all}"

build_android() {
  mkdir -p "$ANDROID_OUTPUT_DIR"
  "$MODULE_SCRIPT" android "$ANDROID_OUTPUT_DIR"
}

build_ios() {
  mkdir -p "$IOS_OUTPUT_DIR"
  "$MODULE_SCRIPT" ios "$IOS_OUTPUT_DIR"
}

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
