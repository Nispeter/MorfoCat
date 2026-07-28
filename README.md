# MorfoCat

Modern geometric morphometrics — a full-featured reimplementation of MorphoJ built with Tauri v2, React 18, TypeScript, and a Python scientific computing sidecar.

## Features

- **Procrustes GPA** — 2D & 3D, with/without object symmetry  
- **Outlier detection** — Procrustes distance Z-scores with include/exclude  
- **PCA** — Scree plot, biplot, shape deformation grids (±N SD)  
- **Covariance matrices** — Standard and pooled within-group  
- **Matrix correlation** — Permutation test  
- **Two-block PLS** — RV coefficient, singular values, block scores  
- **Regression** — Allometry correction, pooled within-group  
- **Modularity** — RV coefficient, covariance ratio (CR), permutation test  
- **CVA** — Canonical variate scores, Mahalanobis distances, permutation test  
- **LDA** — Leave-one-out cross-validation, confusion matrices  
- **Phylogenetics** — Ancestral shape reconstruction, independent contrasts  
- **Quantitative genetics** — G matrix estimation, selection gradient β  
- **Formats** — TPS, NTS, Morphologika import/export  
- **Dark/light mode** · interactive 2D/3D landmark viewers · collapsible sidebar

---

## Installing (for end users)

If someone shared an installer file with you, or you downloaded one from the project's
**Releases** page, you do **not** need Node, Rust, or Python — everything (including the
Python computation engine) is bundled inside. Just install and run.

### Windows

1. Download the installer:
   - **`MorfoCat_<version>_x64-setup.exe`** — recommended for individuals (simple wizard, installs per-user, no admin rights needed)
   - **`MorfoCat_<version>_x64_en-US.msi`** — better for IT / networked deployment
2. **Double-click** it → **Next** → **Install** → **Finish**.
3. Launch **MorfoCat** from the Start menu. That's it — no other tools required.

> **"Windows protected your PC" warning.** Because the build is not code-signed, Windows
> SmartScreen may block it on first launch. Click **More info → Run anyway**. Some antivirus
> tools may also flag it as a false positive (common for PyInstaller-packed apps). This is
> expected for an unsigned build — see
> [Getting rid of the SmartScreen warning](#getting-rid-of-the-smartscreen-warning-windows-code-signing).

### macOS / Linux

Install the artifact for your platform (`.dmg`, `.deb`, or `.AppImage`) — see the formats
table under [Building for distribution](#building-for-distribution-installer). On macOS you
may need to right-click → **Open** the first time to bypass Gatekeeper on an unsigned app.

**Sharing the installer:** it is a single (~70 MB) file. That exceeds most email limits
(e.g. Gmail's 25 MB), so share it via Google Drive, OneDrive, WeTransfer, or a USB drive —
the recipient just double-clicks it.

> **Maintainers:** the installer does not exist until someone builds it. See
> [Building for distribution](#building-for-distribution-installer) to produce it locally, or
> push a version tag to let CI build and attach installers to a GitHub Release.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| Rust | stable | https://rustup.rs |
| Python | ≥ 3.10 | https://python.org |
| WebView2 | (Windows only) | Ships with Win 10/11; download at https://developer.microsoft.com/en-us/microsoft-edge/webview2/ |

---

## Running in development (debug)

```powershell
# 1. Install Python scientific libraries (first time only)
pip install -r python/requirements.txt

# 2. Install Node dependencies (first time only)
npm install

# 3. Launch the dev server + Tauri window
npm run tauri dev
```

The app hot-reloads on React changes. Python sidecar runs directly from `python/sidecar.py` — no build step needed for development.

**What happens under the hood:**
- `vite` serves the React frontend at `http://localhost:1420`
- Tauri opens a native window pointing at that URL
- When you run an analysis, Tauri spawns `python python/sidecar.py`, pipes a JSON request via stdin, and reads the JSON response from stdout

---

## Building for distribution (installer)

One command does both steps:

```powershell
npm run package:win     # macOS / Linux: npm run package:unix
```

> **Always rebuild the sidecar before packaging.** `src-tauri/binaries/` is
> gitignored, so whatever binary is sitting there is from whenever you last built
> it. Tauri bundles it without checking, and an out-of-date sidecar ships an app
> whose analyses silently answer `Unknown method`. The `package:*` scripts above
> rebuild it every time; the two steps below are what they run.

### Step 1 — Build the Python sidecar

The Python code must be compiled to a standalone binary so the installer works on machines without Python.

**Windows (PowerShell):**
```powershell
pip install pyinstaller
.\scripts\build-sidecar.ps1
```

**macOS / Linux (bash):**
```bash
pip3 install pyinstaller
bash scripts/build-sidecar.sh
```

This produces `src-tauri/binaries/morfocat-sidecar-<triple>[.exe]`.

### Step 2 — Build Tauri

```powershell
npm run tauri build
```

Outputs (in `src-tauri/target/release/bundle/`):

| Platform | Location | Format |
|----------|----------|--------|
| Windows | `bundle/msi/*.msi` | MSI installer |
| Windows | `bundle/nsis/*.exe` | NSIS installer |
| macOS | `bundle/dmg/*.dmg` | DMG disk image |
| macOS | `bundle/macos/*.app` | App bundle |
| Linux | `bundle/deb/*.deb` | Debian package |
| Linux | `bundle/appimage/*.AppImage` | AppImage |

Distribute either the `.msi` (Windows), `.dmg` (macOS), or `.deb`/`.AppImage` (Linux) — recipients do **not** need Python, Node, or Rust installed.

---

## Getting rid of the SmartScreen warning (Windows code signing)

SmartScreen is a *reputation* check, not a signature check. An unsigned build
earns reputation per file hash, so every new version starts from zero and small
projects never clear it. Signing moves reputation onto the publisher instead.

| Option | Cost (verify current pricing) | Warning gone |
| --- | --- | --- |
| Unsigned | — | Never, in practice |
| Self-signed certificate | free | No — SmartScreen ignores untrusted CAs |
| [SignPath Foundation](https://signpath.org/) (open source only) | free | Gradually, as downloads accrue |
| Microsoft Store | one-off dev account fee | Yes — Store apps skip SmartScreen |
| [Azure Trusted Signing](https://azure.microsoft.com/products/trusted-signing) | ~USD 10 / month | Immediately |
| OV certificate | ~USD 200–400 / year | Only after enough downloads |
| EV certificate | ~USD 300–600 / year | Immediately |

There is no free publicly trusted code signing certificate. A self-signed one
costs nothing and achieves nothing here — SmartScreen only counts signatures
from a trusted CA.

**SignPath Foundation** signs open-source projects for free. It needs a public
repository under an OSI-approved licence, which this project does not have yet:
add a `LICENSE` file before applying. Their certificate is OV, so the warning
fades as downloads accumulate rather than vanishing at once.

**The Microsoft Store** is the cheapest way to make the warning never appear —
a one-off developer account fee rather than a yearly certificate. Store apps
bypass SmartScreen entirely.

**Azure Trusted Signing** is the sensible paid choice otherwise: an order of
magnitude cheaper than an EV certificate and no USB token. Eligibility rules
have changed more than once, so check the current terms before committing.

Publishing a [winget](https://learn.microsoft.com/windows/package-manager/)
manifest is free and sidesteps the issue for anyone who installs that way, since
`winget install` does not go through the browser download path where SmartScreen
fires. It does nothing for people who download the installer directly.

Since mid-2023 the CA/Browser Forum requires the private key of any publicly
trusted code signing certificate to live on FIPS 140-2 Level 2 hardware — a USB
token or a cloud HSM — so OV certificates now involve a token too, which is what
narrowed the price gap with EV.

### Wiring it into the build

Tauri signs the bundle for you once `bundle.windows` in
`src-tauri/tauri.conf.json` says how. With a certificate installed in the Windows
certificate store:

```json
"bundle": {
  "windows": {
    "certificateThumbprint": "YOUR_CERT_SHA1_THUMBPRINT",
    "digestAlgorithm": "sha256",
    "timestampUrl": "http://timestamp.digicert.com"
  }
}
```

Timestamping matters: without it every signature stops validating the day the
certificate expires, including on copies already installed.

For Azure Trusted Signing or any cloud HSM, hand Tauri the command instead —
`%1` is the file to sign:

```json
"bundle": {
  "windows": {
    "signCommand": "trusted-signing-cli -e <endpoint> -a <account> -c <profile> %1"
  }
}
```

Signing does not silence antivirus false positives from PyInstaller-packed
binaries, though it makes them less likely. If one shows up, submit the
installer to the vendor as a false positive.

## Running the test suite

MorfoCat ships a Python test suite that verifies the numerical correctness of every analysis module using synthetic data with analytically known answers — no MorphoJ installation required.

```bash
# Install pytest (one-time)
pip install pytest

# Run all tests
python -m pytest python/tests/ -v
```

Expected output: **38 tests, all passing**, covering:

| Module | Tests |
|--------|-------|
| Procrustes GPA | Identity, rotation invariance, centred consensus, output shape |
| PCA | Variance sums to 100 %, orthonormal loadings, zero-mean scores |
| Outlier detection | Zero z-scores for identical specimens, correct output length |
| Covariance | Symmetric, positive semi-definite, pooled label |
| Matrix correlation | Self-correlation = 1.0, permutations vary across runs |
| Two-block PLS | RV in [0,1], % covariance sums to 100 %, correlated blocks → high RV |
| Modularity | Permutation null ≠ observed (bug-fix regression), perfect blocks → low RV |
| CVA | Separated groups captured by first CV, n_CVs ≤ groups−1 |
| LDA | Perfect separation → LOO accuracy ≥ 95 %, confusion matrix shape |
| Selection gradient | β length matches shape variables |
| TPS I/O | Parse → write → re-parse: coordinates identical |

---

## Automated CI builds (GitHub Actions)

Push a version tag to trigger cross-platform builds and a draft GitHub Release with all installers attached:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow at `.github/workflows/build.yml` builds on:
- `windows-latest` → `.msi` + `.exe`
- `macos-latest` → `.dmg` (universal binary — Intel + Apple Silicon)
- `ubuntu-22.04` → `.deb` + `.AppImage`

---

## Project structure

```
morfoCat/
├── src/                  # React + TypeScript frontend
│   ├── components/       # UI, layout, plots, landmark viewers
│   ├── pages/            # One page per analysis module
│   ├── store/            # Zustand state (dataset + analysis results)
│   └── lib/ipc.ts        # Typed wrappers for every Tauri→Python call
├── src-tauri/            # Rust/Tauri shell
│   └── src/commands.rs   # IPC bridge: invoke() → Python sidecar
├── python/               # Scientific computing sidecar
│   ├── sidecar.py        # Entry point (reads JSON from stdin, writes JSON to stdout)
│   └── morfoCat/         # Analysis modules
│       ├── io/           # TPS, NTS, Morphologika parsers
│       ├── procrustes.py # GPA
│       ├── pca.py        # PCA
│       ├── cva.py        # CVA
│       ├── lda.py        # LDA + cross-validation
│       ├── regression.py # Regression
│       ├── pls.py        # Two-block PLS
│       ├── modularity.py # Modularity (RV, CR)
│       ├── phylo.py      # Phylogenetic methods
│       └── quantgen.py   # G matrix, selection gradient
└── scripts/              # build-sidecar.sh / build-sidecar.ps1
```

---

## Citation

When using MorfoCat for research, please also cite the original MorphoJ paper:

> Klingenberg, C. P. 2011. MorphoJ: an integrated software package for geometric morphometrics. *Molecular Ecology Resources* 11: 353–357.
