#!/usr/bin/env bash
set -euo pipefail

RUST_VERSION="${RUST_VERSION:-1.85.0}"
CARGO_NDK_VERSION="${CARGO_NDK_VERSION:-3.5.4}"
ANDROID_TARGETS=(
  "aarch64-linux-android"
  "armv7-linux-androideabi"
  "x86_64-linux-android"
)

if [[ "${EAS_BUILD_PLATFORM:-android}" != "android" ]]; then
  echo "Skipping Rust bootstrap for platform: ${EAS_BUILD_PLATFORM:-unknown}"
  exit 0
fi

if [[ -f "$HOME/.cargo/env" ]]; then
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env"
fi

if ! command -v rustup >/dev/null 2>&1; then
  echo "Installing Rust ${RUST_VERSION} via rustup..."
  curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal --default-toolchain "${RUST_VERSION}"
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env"
fi

echo "Ensuring Rust toolchain ${RUST_VERSION} is available..."
rustup toolchain install "${RUST_VERSION}" --profile minimal
rustup default "${RUST_VERSION}"

echo "Ensuring Android Rust targets are installed..."
for target in "${ANDROID_TARGETS[@]}"; do
  rustup target add "${target}" --toolchain "${RUST_VERSION}"
done

if ! command -v cargo-ndk >/dev/null 2>&1; then
  echo "Installing cargo-ndk ${CARGO_NDK_VERSION}..."
  cargo install cargo-ndk --version "${CARGO_NDK_VERSION}" --locked
else
  echo "cargo-ndk already installed."
fi

echo "Rust bootstrap complete."
