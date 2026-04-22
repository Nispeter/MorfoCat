#!/usr/bin/env bash
# Build the Python sidecar with PyInstaller (macOS/Linux).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY_SRC="$ROOT/python"
OUT_DIR="$ROOT/src-tauri/binaries"

echo "Installing Python dependencies…"
pip3 install -r "$PY_SRC/requirements.txt" -q

echo "Building sidecar with PyInstaller…"
python3 -m PyInstaller \
    --onefile \
    --name morfocat-sidecar \
    --distpath "$OUT_DIR" \
    --workpath "$PY_SRC/build" \
    --specpath "$PY_SRC" \
    --noconfirm \
    "$PY_SRC/sidecar.py"

# Rename to include Rust target triple (required by Tauri)
TRIPLE=$(rustc -vV | grep host | cut -d' ' -f2)
mv "$OUT_DIR/morfocat-sidecar" "$OUT_DIR/morfocat-sidecar-$TRIPLE"
chmod +x "$OUT_DIR/morfocat-sidecar-$TRIPLE"
echo "Sidecar built: $OUT_DIR/morfocat-sidecar-$TRIPLE"
