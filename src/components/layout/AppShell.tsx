import { useState } from "react";
import { Sidebar, type PageId } from "./Sidebar";
import DataManager from "@/pages/DataManager";
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

const PAGE_MAP: Record<PageId, React.ComponentType> = {
  "data": DataManager,
  "procrustes": ProcrustesFit,
  "outliers": Outliers,
  "covariance": Covariance,
  "pca": PCA,
  "matrix-corr": MatrixCorr,
  "pls": TwoBlockPLS,
  "regression": Regression,
  "modularity": Modularity,
  "cva": CVA,
  "lda": LDA,
  "phylogenetics": Phylogenetics,
  "quant-genetics": QuantGenetics,
};

export function AppShell() {
  const [activePage, setActivePage] = useState<PageId>("data");
  const ActivePage = PAGE_MAP[activePage];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="flex-1 overflow-hidden">
        <ActivePage />
      </main>
    </div>
  );
}
