#!/usr/bin/env pwsh
<#
    Sign one Windows binary during `tauri build`.

    Tauri calls this once per file it bundles, passing the path as the only
    argument. Which signer runs is decided by environment variables, so the
    certificate never has to live in the repository:

      MORPHOCAT_SIGN_THUMBPRINT   SHA1 thumbprint of a certificate installed in
                                 the Windows certificate store.

      MORPHOCAT_SIGN_COMMAND      Any other signer, as a command line containing
                                 {file} where the path should go - for Azure
                                 Trusted Signing or a cloud HSM.

    With neither set the script exits without signing, so an ordinary build
    still works on a machine that has no certificate.

    Released installers are not signed here: SignPath Foundation signs them for
    free from .github/workflows/build.yml, because it will only sign artifacts
    it can trace back to a CI run. This script is for signing a local build with
    your own certificate.
#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$FilePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $FilePath)) {
    Write-Error "Nothing to sign at '$FilePath'."
}

# Timestamping is not optional: without it every signature stops validating the
# day the certificate expires, including on copies already installed.
$TimestampUrl = if ($env:MORPHOCAT_SIGN_TIMESTAMP) { $env:MORPHOCAT_SIGN_TIMESTAMP }
                else { "http://timestamp.digicert.com" }

if ($env:MORPHOCAT_SIGN_COMMAND) {
    $command = $env:MORPHOCAT_SIGN_COMMAND.Replace("{file}", $FilePath)
    Write-Host "Signing $FilePath with the configured command..."
    cmd /c $command
    if ($LASTEXITCODE -ne 0) { Write-Error "Signing command failed ($LASTEXITCODE)." }
    exit 0
}

if ($env:MORPHOCAT_SIGN_THUMBPRINT) {
    $signtoolPath = (Get-Command signtool.exe -ErrorAction SilentlyContinue).Source

    if (-not $signtoolPath) {
        # signtool ships with the Windows SDK and is not on PATH by default.
        $kits = [Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
        $kitRoot = Join-Path $kits "Windows Kits\10\bin"
        if (Test-Path $kitRoot) {
            $found = Get-ChildItem $kitRoot -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue
            $found = $found | Where-Object { $_.FullName -match "x64" } | Sort-Object FullName -Descending
            if ($found) { $signtoolPath = $found[0].FullName }
        }
    }
    if (-not $signtoolPath) {
        Write-Error "signtool.exe not found - install the Windows SDK, or use MORPHOCAT_SIGN_COMMAND."
    }

    Write-Host "Signing $FilePath with certificate $env:MORPHOCAT_SIGN_THUMBPRINT..."
    & $signtoolPath sign /sha1 $env:MORPHOCAT_SIGN_THUMBPRINT /fd sha256 /td sha256 /tr $TimestampUrl $FilePath
    if ($LASTEXITCODE -ne 0) { Write-Error "signtool failed ($LASTEXITCODE)." }
    exit 0
}

Write-Host "No signing credentials set - leaving '$FilePath' unsigned."
Write-Host "  Set MORPHOCAT_SIGN_THUMBPRINT or MORPHOCAT_SIGN_COMMAND to sign."
exit 0
