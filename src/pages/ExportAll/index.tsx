import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { exportAll } from "@/lib/export";
import { FolderOpen, FileDown, CheckCircle2, Circle, Package } from "lucide-react";

export default function ExportAll() {
  const dataset = useDatasetStore((s) => s.dataset);
  const aligned = useDatasetStore((s) => s.aligned);
  const centroid_sizes = useDatasetStore((s) => s.centroid_sizes);
  const { pca, cva, lda, regression, covariance, modularity, pls, matrixCorr } = useAnalysisStore();

  const [outputDir, setOutputDir] = useState("");
  const [exporting, setExporting] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const ids = dataset?.specimens.filter((s) => s.include).map((s) => s.id) ?? [];

  const pickFolder = useCallback(async () => {
    const result = await open({ directory: true });
    if (result && !Array.isArray(result)) setOutputDir(result as string);
  }, []);

  const handleExport = useCallback(async () => {
    if (!outputDir) {
      toast.error("Pick an output folder first.");
      return;
    }
    setExporting(true);
    setLog([]);
    try {
      const files = await exportAll({
        dir: outputDir,
        ids,
        aligned,
        centroid_sizes,
        pca,
        cva,
        lda,
        regression,
        covariance,
        modularity,
        pls,
        matrixCorr,
      });
      setLog(files);
      toast.success(`Exported ${files.length} file${files.length !== 1 ? "s" : ""}`, {
        description: outputDir,
      });
    } catch (e) {
      toast.error("Export failed", { description: String(e) });
    } finally {
      setExporting(false);
    }
  }, [outputDir, ids, aligned, centroid_sizes, pca, cva, lda, regression, covariance, modularity, pls, matrixCorr]);

  const analyses: Array<{ label: string; ready: boolean; files: string[] }> = [
    {
      label: "Procrustes (aligned coords + centroid sizes)",
      ready: !!aligned,
      files: ["procrustes/aligned_coordinates.csv", "procrustes/centroid_sizes.csv"],
    },
    {
      label: "PCA (scores + eigenvalues)",
      ready: !!pca,
      files: ["pca/pc_scores.csv", "pca/eigenvalues.csv"],
    },
    {
      label: "CVA (scores + Mahalanobis distances)",
      ready: !!cva,
      files: ["cva/cv_scores.csv", "cva/mahalanobis_distances.csv"],
    },
    {
      label: "LDA / Cross-validation",
      ready: !!lda,
      files: ["lda/loo_predictions.csv", "lda/summary.csv"],
    },
    {
      label: "Regression (fitted + residuals)",
      ready: !!regression,
      files: ["regression/fitted.csv", "regression/residuals.csv", "regression/summary.csv"],
    },
    {
      label: "Covariance matrix",
      ready: !!covariance,
      files: ["covariance/covariance_matrix.csv"],
    },
    {
      label: "Modularity (RV/CR + null distribution)",
      ready: !!modularity,
      files: ["modularity/summary.csv", "modularity/null_distribution.csv"],
    },
    {
      label: "Two-block PLS",
      ready: !!pls,
      files: ["pls/singular_values.csv", "pls/rv_summary.csv"],
    },
    {
      label: "Matrix Correlation (Mantel test)",
      ready: !!matrixCorr,
      files: ["matrix_corr/summary.csv", "matrix_corr/null_distribution.csv"],
    },
  ];

  const readyCount = analyses.filter((a) => a.ready).length;

  return (
    <PanelLayout
      title="Export All Results"
      description="Write every completed analysis to CSV files in a folder of your choice"
      actions={
        <Button
          onClick={handleExport}
          disabled={exporting || readyCount === 0 || !outputDir}
        >
          <Package size={14} />
          {exporting ? "Exporting…" : `Export ${readyCount} analysis${readyCount !== 1 ? "es" : ""}`}
        </Button>
      }
    >
      <div className="flex h-full gap-4">
        {/* Left: analysis checklist */}
        <div className="flex flex-1 flex-col gap-3">
          {!dataset && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              No dataset loaded. Load a dataset in Data Manager and run analyses first.
            </div>
          )}

          <Card className="flex flex-1 flex-col overflow-hidden">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <span>Available exports</span>
                <Badge variant={readyCount > 0 ? "default" : "secondary"}>
                  {readyCount} / {analyses.length} ready
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="divide-y">
                  {analyses.map((a) => (
                    <div key={a.label} className={`px-4 py-3 ${a.ready ? "" : "opacity-40"}`}>
                      <div className="flex items-center gap-2">
                        {a.ready
                          ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                          : <Circle size={15} className="text-muted-foreground shrink-0" />
                        }
                        <span className="text-sm font-medium">{a.label}</span>
                        {!a.ready && (
                          <Badge variant="outline" className="text-[10px]">not run</Badge>
                        )}
                      </div>
                      <div className="mt-1 ml-6 space-y-0.5">
                        {a.files.map((f) => (
                          <p key={f} className="font-mono text-xs text-muted-foreground">{f}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right: output folder + log */}
        <div className="flex w-72 flex-col gap-3">
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm">Output Folder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full" onClick={pickFolder}>
                <FolderOpen size={13} /> {outputDir ? "Change folder…" : "Pick folder…"}
              </Button>
              {outputDir && (
                <p className="break-all text-xs text-muted-foreground">{outputDir}</p>
              )}
            </CardContent>
          </Card>

          {log.length > 0 && (
            <Card className="flex flex-1 flex-col overflow-hidden">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileDown size={14} className="text-emerald-500" />
                  Exported files
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full">
                  <div className="space-y-0.5 px-3 pb-3">
                    {log.map((f) => (
                      <p key={f} className="font-mono text-xs text-muted-foreground">{f}</p>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">How to use</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>1. Run the analyses you need (GPA, PCA, CVA, etc.)</p>
              <p>2. Pick an output folder above</p>
              <p>3. Click "Export" — subfolders are created automatically</p>
              <p>4. Open the CSVs in Excel, R, or Python</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PanelLayout>
  );
}
