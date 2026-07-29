# MorphoCat

Geometric morphometrics on your desktop. Place landmarks on photographs, align
them, and get the analyses and publication figures a shape study needs — without
installing Python, R, or anything else.

MorphoCat is a free, open-source reimplementation of MorphoJ. It runs entirely on
your computer: nothing is uploaded, nothing is tracked, and it works offline.

**Español:** [léeme en español](README.es.md)

---

## Install

Download the file for your system from the
[Releases page](https://github.com/Nispeter/MorphoCat/releases) and open it.
Everything the app needs is inside — there is nothing else to install.

| Your system | Download this | Then |
| --- | --- | --- |
| Windows | `MorphoCat_<version>_x64-setup.exe` | Double-click → Next → Install |
| Windows, managed by IT | `MorphoCat_<version>_x64_en-US.msi` | For network deployment |
| macOS | `MorphoCat_<version>.dmg` | Drag MorphoCat to Applications |
| Linux (Debian/Ubuntu) | `MorphoCat_<version>_amd64.deb` | `sudo apt install ./MorphoCat_*.deb` |
| Linux (anything else) | `MorphoCat_<version>.AppImage` | Make it executable and run it |

> **If Windows says "Windows protected your PC"** — click **More info**, then
> **Run anyway**. On macOS, right-click the app and choose **Open** the first
> time. This happens with small independent projects and does not mean anything
> is wrong with the file.

The app is in English and Spanish. Switch language in **Settings**.

---

## How to use it

The short version: get your landmarks in, align them, then analyse. Everything
starts in the **Data Manager**, which is the first page you see.

### 1. Get your landmarks in

**If you already have a landmark file** (`.tps`, `.nts`, or Morphologika `.txt`),
drag it onto the drop zone in the Data Manager. Done — skip to step 2.

**If you are starting from photographs**, use the buttons at the top of the Data
Manager:

- **Pick Images** — choose the photos one by one
- **Add Folder** — take every photo in a folder at once
- **Open TPS** — carry on with a file you started digitizing earlier

Choosing photos opens a small window where you say how many landmarks each
specimen gets, and where to save the `.tps` file.

> **Keep the `.tps` file in the same folder as your photos.** A TPS file records
> the *name* of each image, not the path to it. If the two get separated, the app
> cannot find your photos — it will tell you when this happens, but it is easier
> to avoid.

Then, in the **Landmark Digitizer**:

| To do this | Do that |
| --- | --- |
| Place a landmark | Click on the photo |
| Place a semilandmark | Hold **Shift** and click |
| Undo the last one | **Ctrl+Z** |
| Next / previous specimen | **→** / **←**, or the arrows above the image |
| Set the real-world scale | **Set scale**, click two points, type the real distance |
| Add more photos later | **Add specimens** in the right-hand panel |

When every specimen is finished, click **Load as Dataset**. You are back in the
Data Manager with your data ready.

### 2. Turn your IDs into categories

Most people encode information in the specimen name — site, level, material,
sex. MorphoCat can cut that code into **categories** you can then colour and group
by.

Open the **Categories** card in the Data Manager. With an ID like
`26-13MA020230`, drag across the characters that belong together and give the
piece a name. If your IDs use a separator instead (`ficu_F_031`), switch to
**By separator** and click the part you want. Add as many categories as you like,
then **Apply**.

### 3. Align the shapes

Go to **Procrustes Fit** and click **Run**. This removes differences in position,
size, and rotation so that only shape is left. Every other analysis needs this
first.

### 4. Look for mistakes

**Outlier Detection** shows how far each specimen sits from the average shape. A
specimen sticking far out is usually a digitizing slip, not a discovery — click
it to review its landmarks. If two landmark numbers got swapped, you can fix the
order right there and it applies to the whole dataset.

### 5. Analyse

**PCA** is where most studies start: it shows the main directions of shape
variation and where each specimen falls along them.

Its **Figure** tab builds a publication-ready plot — colour by one category and
symbol by another, place small shape drawings along the axes, drag the legend
where you want it, and export as PNG or SVG.

The rest of the analyses are in the sidebar: covariance matrices, matrix
correlation, two-block PLS, regression and allometry, modularity, CVA, LDA with
cross-validation, phylogenetic comparative methods, and quantitative genetics.

### 6. Save your work

**Save project** writes a single `.morphocat.json` file holding your data, your
categories, your alignment, your figure styling, and your digitizing session.
Open it later and everything comes back as you left it.

Every table and chart also exports on its own — CSV for numbers, PNG or SVG for
figures.

---

## Common questions

**Do I need Python or R installed?** No. The computation engine is bundled inside
the app.

**Does it send my data anywhere?** No. MorphoCat makes no network requests at all.
Your images and files stay on your computer.

**My antivirus flagged it.** This is a known false positive with the way the
computation engine is packaged. The installer from the Releases page is the only
official one.

**Can I use it for 3D data?** Import and the core analyses work in 3D. Landmark
estimation for missing points is 2D only for now.

**Which file formats can I open?** TPS, NTS, and Morphologika for import; TPS and
CSV for export.

---

## For developers

Building MorphoCat from source, running the test suite, and the release process
are documented in **[docs/DEVELOPING.md](docs/DEVELOPING.md)**.

How releases are signed is described in
**[docs/CODE_SIGNING_POLICY.md](docs/CODE_SIGNING_POLICY.md)**.

---

## Citing

If MorphoCat contributed to published research, please also cite the software it
reimplements:

> Klingenberg, C. P. 2011. MorphoJ: an integrated software package for geometric
> morphometrics. *Molecular Ecology Resources* 11: 353–357.

---

## Licence

MIT — see [LICENSE](LICENSE). Free to use, including for commercial work.
