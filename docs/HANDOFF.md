# Handoff — MorphoJ parity work (2026-07-27)

**Goal:** bring MorfoCat to full MorphoJ feature parity so the Benítez practica
(TpsUtil → TpsDig → MorphoJ) runs end-to-end inside the app.
Approved 4-phase plan: `~/.claude/plans/read-all-this-repo-atomic-waterfall.md`.

## Done & verified
`tsc --noEmit` and `vite build` both pass. **Not yet GUI-driven** — verification is compile-level only.

### Phase A — the 3 blockers
- **Digitizer scale tool** — "Set Scale" mode: click 2 reference points → dialog for real length + unit →
  stores units/px per specimen; written as `SCALE=` on TPS export; coords ×scale on "Load as Dataset".
- **Classifiers from ID string** — Data Manager "Classifiers" card: extract by first/last char (live preview),
  activate/rename/delete multiple, editable inline column. PCA/CVA/LDA group & color by the active classifier
  via `ClassifierSelect`. Helper: `src/lib/groups.ts` (`groupsOf`, `hasGroups`).
- **Wireframe editor** — new page (Core group): click-click to link landmarks; `ShapeGrid` &
  `LandmarkViewer2D` take an `edges` prop and draw it instead of the sequential ring; used by PCA & Procrustes.

### Phase B — partial (highest-value, clean-UI items)
- **Outlier landmark-swap** — Outliers "Review" shows the specimen vs consensus + a "Swap landmark n with n"
  control; applies across all specimens, remaps the wireframe, prompts to re-run Procrustes.
- **Merge datasets** — Data Manager "Add specimens" appends another file (same landmark count, dedups IDs).
- **Align by principal axes** — Procrustes toggle (default on), frontend rigid rotation via `src/lib/shape.ts`.

**Store surface added** (`src/store/datasetStore.ts`): `classifiers`/`classifierNames`/`activeClassifier`
(+ extract/set/rename/delete/setActive), `wireframe` (+ addLink/removeLink/clearWireframe),
`swapLandmarks`, `appendSpecimens`. Digitizer store: per-specimen `scale`/`scaleUnit` + `setScale`.

These close several `devnotes.md` items: "add scale to digitalize", "add analysis variable tags",
"define any number of groups… colored by the group selected".

## Remaining (priority order)
- **Phase B leftovers** (frontend, mind UI clutter): object-symmetry landmark pairs UI (backend already
  accepts `sym_pairs`/`midline_lms` — just wire through `ipc.ts`), subset landmarks, average by classifier,
  estimate missing landmarks.
- **Phase C**: TPS transformation grid (`src/lib/tps.ts` + plot component, tab in PCA), export any chart as
  PNG/SVG (wire the existing `downloadChartSVG` in `export.ts`), set-scale-to-factor exact PC value,
  save/open project (`.morfocat.json`).
- **Phase D** (touches Python sidecar — register in `python/sidecar.py` DISPATCH + wrapper in `ipc.ts`):
  pairwise DFA with cross-validation, comparison of covariance matrices, phylogenetic signal.

## Notes for whoever continues
- All Phase A/B work is **frontend only** — Python backend untouched; its 38 tests are unaffected.
- Drive the real flows with `npm run tauri dev` before shipping.
- Classifier test fixture with coded IDs: `python/tests/test_data.tps` (uses `*ID=`).
- UX preference: keep the UI simple/user-friendly, don't expose internal/technical details.
