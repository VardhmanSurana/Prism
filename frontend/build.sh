#!/bin/bash
set -e

echo "Building Prism Backend (Rust)..."
cd ../backend_rust
cargo build --release

echo "Building Prism Frontend (React/Vite)..."
cd ../frontend
pnpm run build

echo "Build complete!"
