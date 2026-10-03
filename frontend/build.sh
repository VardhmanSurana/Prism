#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Building Prism Backend (Rust)..."
cd "$ROOT_DIR/backend_rust"
cargo build --release
TARGET_TRIPLE=$(rustc -vV | sed -n 's|host: ||p')
cp -f target/release/prism-backend-rust "target/release/prism-backend-rust-${TARGET_TRIPLE}"

echo "Building Prism Frontend (React/Vite)..."
cd "$SCRIPT_DIR"
pnpm run build

echo "Build complete!"

