# Mathematical Foundations & References

MorfoCat implements the full suite of geometric morphometrics analyses pioneered by the Klingenberg lab and codified in MorphoJ. This document lists every primary reference, algorithm source, and software dependency used in the implementation.

---

## Acknowledgments

MorfoCat is a reimplementation of **MorphoJ**, created by **Christian Peter Klingenberg** at the University of Manchester. The original software, its algorithms, and its documentation are the intellectual foundation of this project.

> Klingenberg, C. P. (2011). MorphoJ: an integrated software package for geometric morphometrics.
> *Molecular Ecology Resources*, 11(2), 353–357. https://doi.org/10.1111/j.1755-0998.2010.02924.x

If you use MorfoCat in published research, please also cite the original MorphoJ paper above, along with the primary methodological references relevant to the analyses you performed (listed below).

The foundational textbook for the entire discipline is:

> Dryden, I. L., & Mardia, K. V. (1998). *Statistical Shape Analysis*. Wiley, Chichester.

---

## Background: Geometric Morphometrics

Geometric morphometrics is the statistical analysis of biological shape using landmark coordinates. The core idea — representing shape as the residual information in landmark configurations after removing location, scale, and rotation — was formalised in:

> Bookstein, F. L. (1991). *Morphometric Tools for Landmark Data: Geometry and Biology*. Cambridge University Press.

> Rohlf, F. J., & Marcus, L. F. (1993). A revolution in morphometrics. *Trends in Ecology & Evolution*, 8(4), 129–132.

> Slice, D. E. (2005). Modern morphometrics in physical anthropology. *Developments in Primatology: Progress and Prospects*. Springer.

---

## Analysis Methods & Primary References

### 1. Generalized Procrustes Analysis (GPA)

**Implementation:** `python/morfoCat/procrustes.py`

GPA superimposes landmark configurations by iteratively removing differences in position, scale (centroid size), and orientation using least-squares rotation (SVD). Bilateral symmetry enforcement follows the reflection-averaging approach.

> Rohlf, F. J., & Slice, D. E. (1990). Extensions of the Procrustes method for the optimal superimposition of landmarks. *Systematic Zoology*, 39(1), 40–59.

> Gower, J. C. (1975). Generalized Procrustes analysis. *Psychometrika*, 40(1), 33–51.

> Mardia, K. V., Bookstein, F. L., & Moreton, I. J. (2000). Statistical assessment of bilateral symmetry of shapes. *Biometrika*, 87(2), 285–300. *(symmetry component)*

**Centroid size** as the standard size measure:

> Bookstein, F. L. (1991). *Morphometric Tools for Landmark Data*. Cambridge University Press. (Ch. 4)

---

### 2. Outlier Detection

**Implementation:** `python/morfoCat/outliers.py`

Outliers are identified as specimens with unusually large Procrustes distance from the consensus (mean) configuration. Z-scores are computed on the distribution of distances.

> Klingenberg, C. P., & Monteiro, L. R. (2005). Distances and directions in multidimensional shape spaces: implications for morphometric applications. *Systematic Biology*, 54(4), 678–688.

---

### 3. Covariance Matrix

**Implementation:** `python/morfoCat/covariance.py`

Computes the standard variance-covariance matrix, and the pooled within-group covariance matrix (MANOVA-style), which removes between-group variation to estimate within-group shape variance.

> Mardia, K. V., Kent, J. T., & Bibby, J. M. (1979). *Multivariate Analysis*. Academic Press, London.

> Morrison, D. F. (1990). *Multivariate Statistical Methods* (3rd ed.). McGraw-Hill.

---

### 4. Principal Component Analysis (PCA)

**Implementation:** `python/morfoCat/pca.py`

PCA is applied to Procrustes shape coordinates (or a provided covariance matrix) via eigendecomposition of the variance-covariance matrix (`numpy.linalg.eigh`). Shape deformation grids are computed by projecting ±N standard deviations along each PC loading vector back into landmark space.

> Rohlf, F. J. (1993). Relative warps analysis and an example of its application to mosquito wings. In L. F. Marcus et al. (eds.), *Contributions to Morphometrics*. Museo Nacional de Ciencias Naturales, Madrid.

> Jolliffe, I. T. (2002). *Principal Component Analysis* (2nd ed.). Springer, New York.

> Bookstein, F. L. (1989). Principal warps: thin-plate splines and the decomposition of deformations. *IEEE Transactions on Pattern Analysis and Machine Intelligence*, 11(6), 567–585.

---

### 5. Matrix Correlation (Mantel Test)

**Implementation:** `python/morfoCat/matrix_corr.py`

The matrix correlation between two symmetric matrices is computed as the Pearson correlation of their upper-triangle elements. Statistical significance is assessed by a permutation test (random row/column permutations of one matrix).

> Mantel, N. (1967). The detection of disease clustering and a generalized regression approach. *Cancer Research*, 27(2), 209–220.

> Cheverud, J. M., & Dow, M. M. (1985). An autocorrelation analysis of genetic variation due to lineal fission in social groups of rhesus macaques. *American Journal of Physical Anthropology*, 67(2), 113–121.

> Smouse, P. E., Long, J. C., & Sokal, R. R. (1986). Multiple regression and correlation extensions of the Mantel test of matrix correspondence. *Systematic Zoology*, 35(4), 627–632.

---

### 6. Two-Block Partial Least Squares (PLS)

**Implementation:** `python/morfoCat/pls.py`

Two-block PLS finds pairs of linear combinations (singular axes) of two landmark blocks that maximise their covariance, via SVD of the cross-covariance matrix. Integration between blocks is measured by the RV coefficient (Escoufier 1973). The significance of the first singular value is assessed by permutation.

> Rohlf, F. J., & Corti, M. (2000). Use of two-block partial least-squares to study covariation in shape. *Systematic Biology*, 49(4), 740–753.

> Escoufier, Y. (1973). Le traitement des variables vectorielles. *Biometrics*, 29(4), 751–760. *(RV coefficient)*

> McArdle, B. H., & Anderson, M. J. (2001). Fitting multivariate models to community data: a comment on distance-based redundancy analysis. *Ecology*, 82(1), 290–297.

---

### 7. Regression & Allometry

**Implementation:** `python/morfoCat/regression.py`

Ordinary least-squares (OLS) multivariate regression of shape on size (log centroid size) or other predictors. Pooled within-group regression removes between-group differences before estimating the within-group allometric trajectory. The regression score (projection of shape onto the regression vector) follows Monteiro (1999).

> Monteiro, L. R. (1999). Multivariate regression models and geometric morphometrics: the search for causal factors in the analysis of shape. *Systematic Biology*, 48(1), 192–199.

> Bookstein, F. L. (1991). *Morphometric Tools for Landmark Data*. Cambridge University Press. (allometry, Ch. 6)

> Klingenberg, C. P. (1996). Multivariate allometry. In L. F. Marcus et al. (eds.), *Advances in Morphometrics*. Plenum Press, New York.

---

### 8. Modularity Testing (RV & CR)

**Implementation:** `python/morfoCat/modularity.py`

Tests whether a hypothesised modular structure fits the data better than expected by chance. The **RV coefficient** measures overall integration between two blocks. The **covariance ratio (CR)** extends this to more than two modules. Significance is assessed by permutation (random reassignment of landmarks to modules preserving module sizes).

> Escoufier, Y. (1973). Le traitement des variables vectorielles. *Biometrics*, 29(4), 751–760. *(RV coefficient)*

> Adams, D. C. (2016). Evaluating modularity in morphometric data: challenges with the RV coefficient and a new test measure. *Methods in Ecology and Evolution*, 7(5), 565–572. *(CR statistic)*

> Klingenberg, C. P. (2009). Morphometric integration and modularity in configurations of landmarks: tools for evaluating a priori hypotheses. *Evolution & Development*, 11(4), 405–421.

> Klingenberg, C. P., Barluenga, M., & Meyer, A. (2003). Body shape variation in cichlid fishes of the Amphilophus citrinellus species complex. *Biological Journal of the Linnean Society*, 80(3), 397–408.

---

### 9. Canonical Variate Analysis (CVA)

**Implementation:** `python/morfoCat/cva.py`

CVA (also called canonical discriminant analysis) finds linear combinations of shape variables that maximally separate predefined groups. It solves the generalised eigenvalue problem **B·v = λ·W·v** (between-group vs within-group covariance). Mahalanobis distances between group centroids and a permutation test on the first eigenvalue are also computed.

> Fisher, R. A. (1936). The use of multiple measurements in taxonomic problems. *Annals of Eugenics*, 7(2), 179–188.

> Bookstein, F. L., Chernoff, B., Elder, R., Humphries, J., Smith, G., & Strauss, R. (1985). *Morphometrics in Evolutionary Biology*. Academy of Natural Sciences of Philadelphia.

> Campbell, N. A., & Atchley, W. R. (1981). The geometry of canonical variate analysis. *Systematic Zoology*, 30(3), 268–280.

---

### 10. Linear Discriminant Analysis + Cross-Validation (LDA)

**Implementation:** `python/morfoCat/lda.py`

LDA classifies specimens to predefined groups based on shape coordinates, using scikit-learn's `LinearDiscriminantAnalysis`. Leave-one-out (LOO) cross-validation is performed to estimate classification accuracy without bias.

> Fisher, R. A. (1936). The use of multiple measurements in taxonomic problems. *Annals of Eugenics*, 7(2), 179–188.

> Lachenbruch, P. A., & Mickey, M. R. (1968). Estimation of error rates in discriminant analysis. *Technometrics*, 10(1), 1–11. *(LOO cross-validation)*

> Pedregosa, F., et al. (2011). Scikit-learn: machine learning in Python. *Journal of Machine Learning Research*, 12, 2825–2830.

---

### 11. Phylogenetic Mapping & Independent Contrasts (PIC/PGLS)

**Implementation:** `python/morfoCat/phylo.py`

**Ancestral state reconstruction** maps shape variables onto a phylogeny using squared-change parsimony (equivalent to Brownian motion ML reconstruction). **Phylogenetic independent contrasts (PIC)** removes phylogenetic non-independence by computing contrasts at internal nodes, weighted by branch lengths, following Felsenstein (1985).

> Felsenstein, J. (1985). Phylogenies and the comparative method. *The American Naturalist*, 125(1), 1–15. *(independent contrasts)*

> Martins, E. P., & Hansen, T. F. (1997). Phylogenies and the comparative method: a general approach to incorporating phylogenetic information into the analysis of interspecific data. *The American Naturalist*, 149(4), 646–667.

> Maddison, W. P. (1991). Squared-change parsimony reconstructions of ancestral states for continuous-valued characters on a phylogenetic tree. *Systematic Zoology*, 40(3), 304–314.

> Huelsenbeck, J. P., & Ronquist, F. (2001). MRBAYES: Bayesian inference of phylogenetic trees. *Bioinformatics*, 17(8), 754–755.

**Phylogenetic tree parsing** uses the `ete3` library:

> Huerta-Cepas, J., Serra, F., & Bork, P. (2016). ETE 3: reconstruction, analysis, and visualization of phylogenomic data. *Molecular Biology and Evolution*, 33(6), 1635–1638.

---

### 12. Quantitative Genetics: G Matrix & Selection Gradient

**Implementation:** `python/morfoCat/quantgen.py`

**G matrix estimation** uses the half-sib ANOVA method: the additive genetic variance-covariance matrix is estimated as G = 4 × (MS_between_sires − MS_within_sires) / n̄, where sire mean-square components are derived from a MANOVA-style partitioning and n̄ is the harmonic mean family size. This assumes a half-sib breeding design in which half-sibs share 1/4 of additive genetic variance (Lynch & Walsh 1998, Ch. 18).

**Selection gradient** estimates the vector β = **P**⁻¹ **s**, where **P** is the phenotypic covariance matrix and **s** = cov(w, z) is the selection differential (covariance of relative fitness with each trait). The predicted response to selection is **R** = **G**·**β** (approximated here as **P**·**β** when G is not separately estimated).

> Lande, R. (1979). Quantitative genetic analysis of multivariate evolution, applied to brain:body size allometry. *Evolution*, 33(1), 402–416. *(G matrix theory)*

> Lande, R., & Arnold, S. J. (1983). The measurement of selection on correlated characters. *Evolution*, 37(6), 1210–1226. *(selection gradient β)*

> Lynch, M., & Walsh, B. (1998). *Genetics and Analysis of Quantitative Traits*. Sinauer Associates, Sunderland MA. (Ch. 18 — half-sib ANOVA)

> Steppan, S. J., Phillips, P. C., & Houle, D. (2002). Comparative quantitative genetics: evolution of the G matrix. *Trends in Ecology & Evolution*, 17(7), 320–327.

---

## File Formats

### TPS (thin-plate spline)

> Rohlf, F. J. (1993). TPSDIG software. Department of Ecology and Evolution, State University of New York at Stony Brook.

The TPS format is the *de facto* standard for storing 2D landmark coordinate data in geometric morphometrics. Each specimen is delimited by `LM=`, followed by x y coordinate pairs and optional `ID=`, `SCALE=`, and `IMAGE=` fields.

### NTS (NTSYS)

> Rohlf, F. J. (1993). NTSYS-pc: numerical taxonomy and multivariate analysis system. *Exeter Software*, Setauket NY.

### Morphologika

> O'Higgins, P., & Jones, N. (1998). Morphologika: tools for shape analysis. Hull York Medical School.

---

## Software Dependencies

| Library | Role | Citation |
|---|---|---|
| **NumPy** | Array operations, SVD, eigendecomposition | Harris et al. (2020) *Nature* 585:357–362 |
| **SciPy** | Linear algebra, statistics | Virtanen et al. (2020) *Nature Methods* 17:261–272 |
| **scikit-learn** | LDA, cross-validation | Pedregosa et al. (2011) *JMLR* 12:2825–2830 |
| **statsmodels** | OLS regression, ANOVA | Seabold & Perktold (2010) *Proc. SciPy* |
| **ete3** | Phylogenetic tree parsing | Huerta-Cepas et al. (2016) *MBE* 33:1635–1638 |
| **pandas** | Tabular data handling | McKinney (2010) *Proc. SciPy* |
| **React** | Frontend UI | Meta Platforms / React team |
| **Tauri** | Desktop shell (Rust) | Tauri Programme |
| **Three.js** | 3D landmark viewer | mrdoob / Three.js contributors |
| **Recharts** | Charts and plots | recharts contributors |

---

## License

MorfoCat is released under the **Apache License 2.0**.

The mathematical algorithms implemented here are based on published academic work and are not themselves copyrightable. The specific implementations are original code. Where a published algorithm is reproduced closely, the relevant citation is noted inline in the source file.

MorphoJ (Klingenberg 2011) is a separate, closed-source Java application. MorfoCat shares no source code with MorphoJ; it independently reimplements the same published methods using Python (NumPy/SciPy) as the computational backend.
