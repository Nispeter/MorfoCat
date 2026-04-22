import { invoke } from "@tauri-apps/api/core";

export type AnalysisResult<T> = { result: T } | { error: string; traceback?: string };

async function runAnalysis<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const raw = await invoke<AnalysisResult<T>>("run_analysis", { method, params });
  if ("error" in raw) {
    throw new Error(raw.error + (raw.traceback ? `\n\n${raw.traceback}` : ""));
  }
  return raw.result;
}

// ── I/O ──────────────────────────────────────────────────────────────────────

export interface ParsedDataset {
  specimens: Array<{
    id: string | null;
    scale: number | null;
    image: string | null;
    landmarks: number[][];
  }>;
  n_landmarks: number;
  dimensions: number;
}

export const parseTPS = (content: string) =>
  runAnalysis<ParsedDataset>("parse_tps", { content });

export const parseNTS = (content: string) =>
  runAnalysis<ParsedDataset>("parse_nts", { content });

export const parseMorphologika = (content: string) =>
  runAnalysis<ParsedDataset>("parse_morphologika", { content });

export const writeTPS = (
  landmarks: number[][][],
  ids?: string[],
  scale?: number[]
) => runAnalysis<string>("write_tps", { landmarks, ids, scale });

// ── Procrustes ───────────────────────────────────────────────────────────────

export interface ProcrustesResult {
  aligned: number[][][];
  consensus: number[][];
  centroid_sizes: number[];
  procrustes_distances: number[];
  n_specimens: number;
  n_landmarks: number;
  dimensions: number;
}

export const procrustesFit = (
  landmarks: number[][][],
  symmetry = false,
  sym_pairs?: number[][],
  midline_lms?: number[]
) => runAnalysis<ProcrustesResult>("procrustes_gpa", { landmarks, symmetry, sym_pairs, midline_lms });

// ── Outliers ─────────────────────────────────────────────────────────────────

export interface OutlierResult {
  procrustes_distances: number[];
  mean_distance: number;
  std_distance: number;
  z_scores: number[];
}

export const detectOutliers = (aligned: number[][][]) =>
  runAnalysis<OutlierResult>("detect_outliers", { aligned });

// ── Covariance ───────────────────────────────────────────────────────────────

export interface CovarianceResult {
  covariance: number[][];
  n_specimens: number;
  n_variables: number;
  type: string;
}

export const computeCovariance = (
  aligned: number[][][],
  groups?: string[],
  pooled = false
) => runAnalysis<CovarianceResult>("compute_covariance", { aligned, groups, pooled });

// ── PCA ──────────────────────────────────────────────────────────────────────

export interface PCAResult {
  scores: number[][];
  loadings: number[][];
  eigenvalues: number[];
  pct_variance: number[];
  cumulative_pct: number[];
  n_components: number;
  n_specimens: number;
}

export const runPCA = (aligned: number[][][], cov_matrix?: number[][]) =>
  runAnalysis<PCAResult>("run_pca", { aligned, cov_matrix });

// ── Matrix correlation ────────────────────────────────────────────────────────

export interface MatrixCorrResult {
  r: number;
  p_value: number;
  permutations: number;
  null_distribution: number[];
}

export const matrixCorrelation = (
  matrix_a: number[][],
  matrix_b: number[][],
  permutations = 999
) => runAnalysis<MatrixCorrResult>("matrix_correlation", { matrix_a, matrix_b, permutations });

// ── Two-block PLS ─────────────────────────────────────────────────────────────

export interface PLSResult {
  singular_values: number[];
  pct_covariance: number[];
  x_loadings: number[][];
  y_loadings: number[][];
  x_scores: number[][];
  y_scores: number[][];
  rv_coefficient: number;
  p_value_sv1: number;
  permutations: number;
}

export const twoBlockPLS = (
  block1: number[][][] | number[][],
  block2: number[][][] | number[][],
  permutations = 999
) => runAnalysis<PLSResult>("two_block_pls", { block1, block2, permutations });

// ── Regression ───────────────────────────────────────────────────────────────

export interface RegressionResult {
  coefficients: number[][];
  fitted: number[][];
  residuals: number[][];
  r_squared: number;
  f_statistic?: number;
  p_value?: number;
  regression_scores?: number[];
  type: string;
}

export const runRegression = (
  dependent: number[][][] | number[][],
  independent: number[] | number[][],
  groups?: string[],
  pooled = false
) => runAnalysis<RegressionResult>("run_regression", { dependent, independent, groups, pooled });

// ── Modularity ────────────────────────────────────────────────────────────────

export interface ModularityResult {
  rv_coefficient: number;
  cr_statistic: number;
  p_value_rv: number;
  p_value_cr: number;
  permutations: number;
  null_rv: number[];
  null_cr: number[];
  n_modules: number;
  module_sizes: number[];
}

export const testModularity = (
  aligned: number[][][],
  hypothesis: number[][],
  permutations = 999
) => runAnalysis<ModularityResult>("test_modularity", { aligned, hypothesis, permutations });

// ── CVA ───────────────────────────────────────────────────────────────────────

export interface CVAResult {
  cv_scores: number[][];
  eigenvalues: number[];
  pct_variance: number[];
  loadings: number[][];
  group_centroids: number[][];
  groups: string[];
  mahalanobis_distances: Array<{ group1: string; group2: string; distance: number }>;
  p_value: number;
  permutations: number;
  n_cvs: number;
}

export const runCVA = (
  aligned: number[][][],
  groups: string[],
  permutations = 999
) => runAnalysis<CVAResult>("run_cva", { aligned, groups, permutations });

// ── LDA ───────────────────────────────────────────────────────────────────────

export interface LDAResult {
  ld_scores: number[][];
  predictions: string[];
  loo_predictions: string[];
  loo_accuracy: number;
  confusion_matrix: number[][];
  loo_confusion_matrix: number[][];
  groups: string[];
  explained_variance_ratio: number[];
}

export const runLDA = (aligned: number[][][], groups: string[]) =>
  runAnalysis<LDAResult>("run_lda", { aligned, groups });

// ── Phylogenetics ─────────────────────────────────────────────────────────────

export interface PhyloMappingResult {
  node_values: Record<string, number[]>;
  tip_ids: string[];
  method: string;
  warning?: string;
}

export const runPhyloMapping = (
  aligned: number[][][],
  tree_newick: string,
  ids: string[]
) => runAnalysis<PhyloMappingResult>("run_phylo_mapping", { aligned, tree_newick, ids });

export interface PICResult {
  contrasts: Array<{ contrast: number[]; variance: number }>;
  n_contrasts: number;
  method: string;
  warning?: string;
}

export const runIndependentContrasts = (
  aligned: number[][][],
  tree_newick: string,
  ids: string[]
) => runAnalysis<PICResult>("run_independent_contrasts", { aligned, tree_newick, ids });

// ── Quantitative genetics ─────────────────────────────────────────────────────

export interface GMatrixResult {
  g_matrix: number[][];
  eigenvalues: number[];
  eigenvectors: number[][];
  n_sires: number;
  n_specimens: number;
}

export const runGMatrix = (
  aligned: number[][][],
  sire_ids: string[],
  dam_ids: string[]
) => runAnalysis<GMatrixResult>("run_g_matrix", { aligned, sire_ids, dam_ids });

export interface SelectionGradientResult {
  selection_gradient: number[];
  response_to_selection: number[];
  n_specimens: number;
  mean_fitness: number;
}

export const runSelectionGradient = (aligned: number[][][], fitness: number[]) =>
  runAnalysis<SelectionGradientResult>("run_selection_gradient", { aligned, fitness });
