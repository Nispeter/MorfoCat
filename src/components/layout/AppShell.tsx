import { Sidebar, type PageId } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { useNavStore } from "@/store/navStore";
import DataManager from "@/pages/DataManager";
import ImageImport from "@/pages/ImageImport";
import Digitizer from "@/pages/Digitizer";
import ProcrustesFit from "@/pages/ProcrustesFit";
import Outliers from "@/pages/Outliers";
import Covariance from "@/pages/Covariance";
import PCA from "@/pages/PCA";
import MatrixCorr from "@/pages/MatrixCorr";
import TwoBlockPLS from "@/pages/TwoBlockPLS";
import Regression from "@/pages/Regression";
import Modularity from "@/pages/Modularity";
import CVA from "@/pages/CVA";
import LDA from "@/pages/LDA";
import Phylogenetics from "@/pages/Phylogenetics";
import QuantGenetics from "@/pages/QuantGenetics";
import ExportAll from "@/pages/ExportAll";

const PAGE_MAP: Record<PageId, React.ComponentType> = {
  "data":           DataManager,
  "image-import":   ImageImport,
  "digitizer":      Digitizer,
  "procrustes":     ProcrustesFit,
  "outliers":       Outliers,
  "covariance":     Covariance,
  "pca":            PCA,
  "matrix-corr":    MatrixCorr,
  "pls":            TwoBlockPLS,
  "regression":     Regression,
  "modularity":     Modularity,
  "cva":            CVA,
  "lda":            LDA,
  "phylogenetics":  Phylogenetics,
  "quant-genetics": QuantGenetics,
  "export-all":     ExportAll,
};

export function AppShell() {
  const activePage = useNavStore((s) => s.activePage);
  const ActivePage = PAGE_MAP[activePage];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <ActivePage />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
