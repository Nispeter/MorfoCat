# MorphoCat

MorphoCat is a desktop program for geometric morphometrics. You place landmarks
on photographs, align the specimens, run the analyses and export figures for
publication. Nothing else has to be installed, and it works without an internet
connection.

It is free software, and a reimplementation of MorphoJ.

[Español](README.es.md)

## Install

Download the file for your system from
[Releases](https://github.com/Nispeter/MorphoCat/releases) and open it.

| System | File |
| --- | --- |
| Windows | `MorphoCat_<version>_x64-setup.exe` |
| Windows (IT deployment) | `MorphoCat_<version>_x64_en-US.msi` |
| Debian / Ubuntu | `MorphoCat_<version>_amd64.deb` |
| Other Linux | `MorphoCat_<version>.AppImage` |

The first time you run it, Windows may say "Windows protected your PC". Click
**More info**, then **Run anyway**.

There is no macOS build yet. The program does run on macOS, but you have to
[build it from source](docs/DEVELOPING.md).

The interface is in English and Spanish. You change it in **Settings**.

## Use

Everything starts in the **Data Manager**.

To try the program before digitizing anything of your own, use
[`data/mosca_test.tps`](data/mosca_test.tps), a dataset of 24 fly wings. Drag it
in and skip to step 3. The same data is also saved as a finished project in
[`data/mosca_test.morphocat.json`](data/mosca_test.morphocat.json), with its
categories and figure styling.

### 1. Load your landmarks

If you already have a `.tps`, `.nts` or Morphologika `.txt` file, drag it onto
the drop zone.

To start from photographs, use **Pick Images** or **Add Folder**. You then say
how many landmarks each specimen gets and where to save the `.tps` file.

![Choosing images and the landmark count for a new session](docs/mf0.PNG)

> Keep the `.tps` file in the same folder as the photos. A TPS file stores the
> name of each image, not a path to it, so the program cannot find your photos
> once the two are separated.

### 2. Digitize

| | |
| --- | --- |
| Place a landmark | Click |
| Place a semilandmark | **Shift** + click |
| Undo | **Ctrl+Z** |
| Next / previous specimen | **→** / **←** |
| Real-world scale | **Set scale**, click two points, type the distance |
| More photos later | **Add specimens** |

![Placing landmarks on a fly wing, with progress on the right](docs/mf1.PNG)

Once every specimen is finished, click **Load as Dataset**.

### 3. Split IDs into categories

Open **Categories**. Drag across the characters that belong together and give
them a name, so that `26-13MA020230` becomes site, level, or whatever you
encoded in it. If your IDs use a separator instead, as in `ficu_F_031`, switch
to **By separator** and click the part you want. Then click **Apply**.

![Carving species, family and number out of the specimen IDs](docs/mf2.PNG)

### 4. Align

Go to **Procrustes Fit** and click **Run**. This removes differences of
position, size and rotation, so that only shape is left. The other analyses need
it done first.

### 5. Check for mistakes

**Outlier Detection** ranks the specimens by their distance from the mean shape.
A specimen that sits far out is usually a digitizing slip rather than a
discovery, so click it to review its landmarks. If two landmark numbers were
swapped, you can correct the order there, and the correction applies to the
whole dataset.

### 6. Analyse

Most studies start with **PCA**. Its **Figure** tab builds the plot you publish.
You can colour the points by one category and choose their symbols by another,
place shape drawings along the axes, move the legend, and export to PNG or SVG.

![The PCA figure: points coloured by species, wireframes along both axes](docs/mf3.PNG)

The sidebar holds the rest: covariance matrices, matrix correlation, two-block
PLS, regression and allometry, modularity, CVA, LDA with cross-validation,
phylogenetic comparative methods and quantitative genetics.

### 7. Save

**Save project** writes a single `.morphocat.json` file with your data, your
categories, the alignment, the figure styling and your digitizing session. Every
table also exports on its own to CSV, and every chart to PNG or SVG.

## Notes

- The program uploads nothing and makes no network requests.
- It imports TPS, NTS and Morphologika files, and exports TPS and CSV.
- 3D data works for import and for the main analyses. Estimating missing
  landmarks is 2D only.
- Some antivirus programs report a false positive, because of the way the
  computation engine is packaged. The Releases page is the only official source.

## More

- [Building from source](docs/DEVELOPING.md)
- [Code signing](docs/CODE_SIGNING_POLICY.md)
- [References](REFERENCES.md)
- [MIT licence](LICENSE)

If MorphoCat contributed to published research, please cite MorphoJ as well:

> Klingenberg, C. P. 2011. MorphoJ: an integrated software package for geometric
> morphometrics. *Molecular Ecology Resources* 11: 353–357.

---

*Morpho* for morphometrics, *Cat* for categorization, and for the cat.
