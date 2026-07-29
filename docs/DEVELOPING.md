# Developing MorphoCat

Everything a contributor needs. Users want [the README](../README.md) instead.

## How it fits together

A Tauri v2 shell hosts a React frontend and spawns a Python process for the
numerical work. The frontend never computes anything statistical itself: it sends
a JSON request over stdin and reads a JSON response from stdout. That split is
why the app can ship SciPy without asking anyone to install Python.

```
morphoCat/
├── src/                  # React + TypeScript frontend
│   ├── components/       # UI, layout, plots, landmark viewers
│   ├── pages/            # One page per analysis module
│   ├── store/            # Zustand state (dataset + analysis results)
│   └── lib/ipc.ts        # Typed wrapper for every Tauri -> Python call
├── src-tauri/            # Rust/Tauri shell
│   └── src/commands.rs   # IPC bridge: invoke() -> Python sidecar
├── python/               # Scientific computing sidecar
│   ├── sidecar.py        # Entry point (JSON in on stdin, JSON out on stdout)
│   └── morphoCat/         # Analysis modules
│       ├── io/           # TPS, NTS, Morphologika parsers
│       ├── procrustes.py # GPA
│       ├── pca.py        # PCA
│       ├── cva.py        # CVA
│       ├── lda.py        # LDA + cross-validation
│       ├── dfa.py        # Pairwise DFA
│       ├── regression.py # Regression
│       ├── pls.py        # Two-block PLS
│       ├── modularity.py # Modularity (RV, CR)
│       ├── phylo.py      # Phylogenetic methods
│       └── quantgen.py   # G matrix, selection gradient
└── scripts/              # Sidecar and signing helpers
```

## Prerequisites

| Tool | Version | Install |
| --- | --- | --- |
| Node.js | >= 18 | https://nodejs.org |
| Rust | stable | https://rustup.rs |
| Python | >= 3.10 | https://python.org |
| WebView2 | Windows only | Ships with Win 10/11, otherwise https://developer.microsoft.com/microsoft-edge/webview2/ |

## Running in development

```bash
pip install -r python/requirements.txt   # first time only
npm install                              # first time only
npm run tauri dev
```

The frontend hot-reloads. The sidecar runs straight from `python/sidecar.py`, so
Python changes need no build step — but they do need the window reopened, since
the process is spawned per request.

## Tests

```bash
pip install pytest
python -m pytest python/tests/ -v
```

72 tests, all synthetic data with analytically known answers, so nothing depends
on having MorphoJ around to compare against. They cover Procrustes GPA, PCA,
outlier detection, covariance, matrix correlation, two-block PLS, modularity,
CVA, LDA, selection gradients, and TPS round-tripping.

The frontend has no test suite; `npx tsc --noEmit` and `npx vite build` are the
checks that exist.

## Building installers

```bash
npm run package:win     # macOS / Linux: npm run package:unix
```

**Always rebuild the sidecar before packaging.** `src-tauri/binaries/` is
gitignored, so whatever binary is sitting there is from whenever it was last
built. Tauri bundles it without checking, and a stale sidecar ships an app whose
analyses answer `Unknown method` at runtime. The `package:*` scripts rebuild it
every time; the two steps below are what they run.

```bash
# 1. Compile the Python sidecar to a standalone binary
pip install pyinstaller
./scripts/build-sidecar.ps1        # or: bash scripts/build-sidecar.sh

# 2. Build the app
npm run tauri build
```

Output lands in `src-tauri/target/release/bundle/`: `msi/` and `nsis/` on
Windows, `dmg/` and `macos/` on macOS, `deb/` and `appimage/` on Linux.

## Releasing

Pushing a tag that starts with `v` runs `.github/workflows/build.yml`, which
builds on `windows-latest`, `macos-latest` (universal binary) and `ubuntu-22.04`,
signs the Windows installers if signing is configured, and opens a **draft**
GitHub Release with everything attached.

```bash
git tag -a v0.1.0 -m "MorphoCat v0.1.0"
git push origin v0.1.0
```

The release is a draft on purpose — check the attached installers, then publish
it by hand from the Releases page. Nothing is public until you do.

To redo a botched tag:

```bash
git tag -d v0.1.0 && git push origin :refs/tags/v0.1.0
```

## Signing

Windows installers are signed by SignPath Foundation, from CI, as described in
[CODE_SIGNING_POLICY.md](CODE_SIGNING_POLICY.md). The signing job skips itself
unless these exist on the repository:

| Kind | Name |
| --- | --- |
| Variable | `SIGNPATH_ORGANIZATION_ID` |
| Variable | `SIGNPATH_PROJECT_SLUG` |
| Variable | `SIGNPATH_POLICY_SLUG` |
| Secret | `SIGNPATH_API_TOKEN` |

`scripts/sign-windows.ps1` is a separate path for signing a local build with your
own certificate, driven by `MORPHOCAT_SIGN_THUMBPRINT` or `MORPHOCAT_SIGN_COMMAND`.
It is not what releases use.

## Conventions

- Commits: one gitmoji, a title, nothing else.
- Line endings are mixed across the repo. When editing with a script, write bytes
  that match the newline the file already uses, or the diff becomes unreadable.
- Every user-facing string goes through `t()` in `src/lib/i18n.ts`. The Spanish
  table is typed as `Record<keyof typeof en, string>`, so a missing translation
  is a compile error. Spanish is neutral (tuteo), not regional.
