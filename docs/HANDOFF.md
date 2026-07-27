# Handoff — MorphoJ parity work (updated 2026-07-27)

**Goal:** bring MorfoCat to full MorphoJ feature parity so the Benítez practica
(TpsUtil → TpsDig → MorphoJ) runs end-to-end inside the app.

## Verification status

`tsc --noEmit`, `vite build` and `cargo check` all pass; the Python suite is at
**60 passing tests** (`python -m pytest python/tests/`). Everything below is
verified at compile/test level only — **none of it has been driven through the
GUI yet**. Run `npm run tauri dev` and walk the real flows before shipping.

## Phase A — the 3 blockers (done earlier)

- **Digitizer scale tool** — click 2 reference points → real length + unit →
  units/px per specimen, written as `SCALE=` on TPS export, applied on "Load as Dataset".
- **Classifiers from ID string** — Data Manager "Classifiers" card; PCA/CVA/LDA
  group and colour by the active classifier. Helper: `src/lib/groups.ts`.
- **Wireframe editor** — click-click landmark linking; `ShapeGrid` and
  `LandmarkViewer2D` take an `edges` prop.

## Phase B — complete

- **Outlier landmark-swap** — review a specimen against the consensus and swap misnumbered landmarks.
- **Merge datasets** — "Add specimens" appends another file.
- **Align by principal axes** — Procrustes toggle, `src/lib/shape.ts`.
- **Object-symmetry pairs UI** — `SymmetryCard` in Procrustes Fit; pairs and midline
  landmarks feed `sym_pairs`/`midline_lms` through to the Python GPA.
- **Subset landmarks** — Data Manager → Transform → "Choose landmarks…"; renumbers
  the wireframe and symmetry pairs, drops links to removed landmarks.
- **Average by classifier** — collapses the sample to one averaged specimen per value.
- **Estimate missing landmarks** — TPS warp of the complete-specimen consensus onto
  each incomplete specimen (`src/lib/missing.ts`). Missing = NaN or |coord| ≥ 999.

## Phase C — complete

- **TPS transformation grid** — `src/lib/tps.ts` (thin-plate spline + deformation grid),
  `TpsGrid` component, "Transformation Grid" tab in PCA.
- **Chart export** — `src/lib/chartExport.ts` inlines computed styles and rasterizes at
  3×; `ChartFrame` wraps every chart with PNG/SVG buttons in its top-right corner.
- **Exact PC value** — the shape-deformation and grid tabs take either ±SD or a typed PC score.
- **Save/open project** — `.morfocat.json` via `src/lib/project.ts`; stores the dataset,
  classifiers, wireframe, symmetry pairs and the Procrustes fit.

## Phase D — complete (Python + UI)

- **Pairwise DFA** (`python/morfoCat/dfa.py`) — Procrustes and Mahalanobis distance per
  group pair with permutation tests, plus leave-one-out classification rate.
  UI: LDA page → "Pairwise DFA" tab.
- **Comparison of covariance matrices** (`python/morfoCat/covmatrix_compare.py`) —
  matrix correlation (with/without diagonal) and random skewers, permutation-tested.
  UI: Covariance page → "Compare groups" tab.
- **Phylogenetic signal** (`run_phylogenetic_signal` in `python/morfoCat/phylo.py`) —
  multivariate Kmult (Adams 2014) with a permutation test. Includes a self-contained
  Newick parser, so this path does **not** depend on ete3.
  UI: Phylogenetics page → "Phylogenetic Signal" tab.

## Figure work (from devnotes)

`PCAFigure` + `FigureStylePanel` (PCA → "Figure" tab) reproduce `docs/image.png`:
per-group colour/name/symbol, shape references along both axes, auto/symmetric/manual
axis limits, hover read-out, draggable legend, single-SVG export. Group styling lives in
`src/store/plotStyleStore.ts` and is shared with the biplot.

## Notes for whoever continues

- Repo has **mixed line endings** (some files LF, some CRLF). If you script edits, write
  bytes and match the file's own newline — `Path.write_text` on Windows will double them.
- Rust side: `list_dir_images` backs "Add Folder…" in Image Import.
- Classifier test fixture with coded IDs: `python/tests/test_data.tps` (uses `*ID=`).
- UX preference: keep the UI simple/user-friendly, don't expose internal/technical details.
- Remaining items are listed at the top of `docs/devnotes.md`.
