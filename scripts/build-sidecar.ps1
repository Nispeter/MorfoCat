#!/usr/bin/env pwsh
# Build the Python sidecar with PyInstaller and place it where Tauri expects it.
# Run this BEFORE `tauri build`.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root    = Split-Path $PSScriptRoot -Parent
$PySrc   = Join-Path $Root "python"
$OutDir  = Join-Path $Root "src-tauri" "binaries"

Write-Host "Installing Python dependencies…"
python -m pip install -r "$PySrc\requirements.txt" --quiet

Write-Host "Building sidecar with PyInstaller…"
python -m PyInstaller `
    --onefile `
    --name morfocat-sidecar `
    --distpath "$OutDir" `
    --workpath "$PySrc\build" `
    --specpath "$PySrc" `
    --noconfirm `
    "$PySrc\sidecar.py"

# Tauri expects binaries named with the target triple, e.g.:
# morfocat-sidecar-x86_64-pc-windows-msvc.exe  (Windows)
# morfocat-sidecar-x86_64-unknown-linux-gnu     (Linux)
# morfocat-sidecar-x86_64-apple-darwin          (macOS)

$Triple = (rustc -vV | Select-String "host:").ToString().Split(":")[1].Trim()
$Src = Join-Path $OutDir "morfocat-sidecar.exe"
if (Test-Path $Src) {
    $Dst = Join-Path $OutDir "morfocat-sidecar-$Triple.exe"
    Copy-Item $Src $Dst -Force
    Write-Host "Sidecar built: $Dst"
} else {
    Write-Error "PyInstaller output not found at $Src"
}
