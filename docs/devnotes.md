
## Open

- add code  *(unclear what this meant — needs restating before it can be picked up)*
- interactive plotting on the remaining recharts panels (PLS, modularity,
  matrix correlation) — PCA, biplot and outliers already read out on hover
- finish the i18n sweep: page titles, page-level actions and the plot controls
  are translated, but inline card hints and toast text are still English only
- customize the side image on the PCA graphs *(shape references are drawn from
  the wireframe — a per-figure override for which drawing to use is still open)*

## Done

- add scale to digitalize — "Set Scale" in the Digitizer, written as `SCALE=` on TPS export
- font on dark theme — `color-scheme` per theme, native selects themed, contrast raised
- add analysis variable tags — classifiers extracted from the ID string
- add value graphs to the side of PCA — shape references along both axes (Figure tab)
- on image import select multiple images or select folder — "Add Folder…"
- fix landmark selector to have minimum 0 characters but minimum 1 value — `NumberInput`
- biplot dropdowns bug on dark theme — fixed by `color-scheme` + themed `option`
- interactive plotting (values on mouse) — PCA figure, biplot and distance plot
- plot axis max and min for representativity — auto / symmetric / manual in the Figure tab
- outliers graph with Procrustes distance per image and Mahalanobis distance
- define any number of groups or variables, graphs coloured by the selected group
- gray out on sidebar the functionalities that are not ready (with the reason on hover)
- standardize the screens — every chart sits in a `ChartFrame` with PNG/SVG export top right
- for data input add a mark if data is loaded — dot on Data Manager and Procrustes Fit
- add graphs at both axis to PCA (docs/image.png) — Figure tab: editable cluster
  colours/names/symbols, shape references on both axes, draggable legend, PNG/SVG export
- make sure the traductions are correct — Spanish terms corrected, coverage extended
