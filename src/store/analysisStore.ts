import { create } from "zustand";
import type {
  PCAResult,
  CVAResult,
  LDAResult,
  RegressionResult,
  PLSResult,
  ModularityResult,
  MatrixCorrResult,
  PhyloMappingResult,
  PICResult,
  GMatrixResult,
  SelectionGradientResult,
  CovarianceResult,
  OutlierResult,
} from "@/lib/ipc";

interface AnalysisState {
  pca: PCAResult | null;
  cva: CVAResult | null;
  lda: LDAResult | null;
  regression: RegressionResult | null;
  pls: PLSResult | null;
  modularity: ModularityResult | null;
  matrixCorr: MatrixCorrResult | null;
  phyloMapping: PhyloMappingResult | null;
  pic: PICResult | null;
  gMatrix: GMatrixResult | null;
  selectionGradient: SelectionGradientResult | null;
  covariance: CovarianceResult | null;
  outliers: OutlierResult | null;

  loading: Record<string, boolean>;
  errors: Record<string, string | null>;

  setPCA: (r: PCAResult) => void;
  setCVA: (r: CVAResult) => void;
  setLDA: (r: LDAResult) => void;
  setRegression: (r: RegressionResult) => void;
  setPLS: (r: PLSResult) => void;
  setModularity: (r: ModularityResult) => void;
  setMatrixCorr: (r: MatrixCorrResult) => void;
  setPhyloMapping: (r: PhyloMappingResult) => void;
  setPIC: (r: PICResult) => void;
  setGMatrix: (r: GMatrixResult) => void;
  setSelectionGradient: (r: SelectionGradientResult) => void;
  setCovariance: (r: CovarianceResult) => void;
  setOutliers: (r: OutlierResult) => void;

  setLoading: (key: string, val: boolean) => void;
  setError: (key: string, err: string | null) => void;
  clearAll: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  pca: null, cva: null, lda: null, regression: null, pls: null,
  modularity: null, matrixCorr: null, phyloMapping: null, pic: null,
  gMatrix: null, selectionGradient: null, covariance: null, outliers: null,
  loading: {}, errors: {},

  setPCA: (pca) => set({ pca }),
  setCVA: (cva) => set({ cva }),
  setLDA: (lda) => set({ lda }),
  setRegression: (regression) => set({ regression }),
  setPLS: (pls) => set({ pls }),
  setModularity: (modularity) => set({ modularity }),
  setMatrixCorr: (matrixCorr) => set({ matrixCorr }),
  setPhyloMapping: (phyloMapping) => set({ phyloMapping }),
  setPIC: (pic) => set({ pic }),
  setGMatrix: (gMatrix) => set({ gMatrix }),
  setSelectionGradient: (selectionGradient) => set({ selectionGradient }),
  setCovariance: (covariance) => set({ covariance }),
  setOutliers: (outliers) => set({ outliers }),

  setLoading: (key, val) => set((s) => ({ loading: { ...s.loading, [key]: val } })),
  setError: (key, err) => set((s) => ({ errors: { ...s.errors, [key]: err } })),
  clearAll: () => set({
    pca: null, cva: null, lda: null, regression: null, pls: null,
    modularity: null, matrixCorr: null, phyloMapping: null, pic: null,
    gMatrix: null, selectionGradient: null, covariance: null, outliers: null,
    loading: {}, errors: {},
  }),
}));
