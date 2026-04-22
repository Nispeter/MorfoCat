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
