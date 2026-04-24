import { useState, useCallback, useEffect, useMemo } from "react";
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
import { FolderOpen, FileDown, Package } from "lucide-react";

type ExportKey =
  | "procrustes"
  | "pca"
  | "cva"
  | "lda"
  | "regression"
  | "covariance"
  | "modularity"
  | "pls"
  | "matrixCorr";

export default function ExportAll() {
  const dataset = useDatasetStore((s) => s.dataset);
  const aligned = useDatasetStore((s) => s.aligned);
  const centroid_sizes = useDatasetStore((s) => s.centroid_sizes);
  const { pca, cva, lda, regression, covariance, modularity, pls, matrixCorr } = useAnalysisStore();

  const [outputDir, setOutputDir] = useState("");
  const [exporting, setExporting] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<ExportKey>>(new Set());

  const ids = dataset?.specimens.filter((s) => s.include).map((s) => s.id) ?? [];

  // Auto-select newly ready analyses
  const readiness: Record<ExportKey, boolean> = useMemo(() => ({
    procrustes: !!aligned,
    pca:        !!pca,
    cva:        !!cva,
    lda:        !!lda,
    regression: !!regression,
    covariance: !!covariance,
    modularity: !!modularity,
    pls:        !!pls,
    matrixCorr: !!matrixCorr,
  }), [aligned, pca, cva, lda, regression, covariance, modularity, pls, matrixCorr]);

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      (Object.keys(readiness) as ExportKey[]).forEach((k) => {
        if (readiness[k]) next.add(k);
        else next.delete(k);
      });
      return next;
    });
  }, [readiness]);

  const toggle = useCallback((key: ExportKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const readyKeys = (Object.keys(readiness) as ExportKey[]).filter((k) => readiness[k]);
  const allReadySelected = readyKeys.length > 0 && readyKeys.every((k) => selected.has(k));

  const toggleAll = useCallback(() => {
    if (allReadySelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(readyKeys));
    }
  }, [allReadySelected, readyKeys]);

  const pickFolder = useCallback(async () => {
    const result = await open({ directory: true });
    if (result && !Array.isArray(result)) setOutputDir(result as string);
  }, []);

  const handleExport = useCallback(async () => {
    if (!outputDir) { toast.error("Pick an output folder first."); return; }
    if (selected.size === 0) { toast.error("Select at least one analysis to export."); return; }
    setExporting(true);
    setLog([]);
    try {
      const files = await exportAll({
        dir: outputDir,
        ids,
        aligned:        selected.has("procrustes") ? aligned        : null,
        centroid_sizes: selected.has("procrustes") ? centroid_sizes : null,
        pca:            selected.has("pca")        ? pca            : null,
        cva:            selected.has("cva")        ? cva            : null,
        lda:            selected.has("lda")        ? lda            : null,
        regression:     selected.has("regression") ? regression     : null,
        covariance:     selected.has("covariance") ? covariance     : null,
        modularity:     selected.has("modularity") ? modularity     : null,
        pls:            selected.has("pls")        ? pls            : null,
        matrixCorr:     selected.has("matrixCorr") ? matrixCorr     : null,
      });
      setLog(files);
      toast.success(`Exported ${files.length} file${files.length !== 1 ? "s" : ""}`, { description: outputDir });
    } catch (e) {
      toast.error("Export failed", { description: String(e) });
    } finally {
      setExporting(false);
    }
  }, [outputDir, selected, ids, aligned, centroid_sizes, pca, cva, lda, regression, covariance, modularity, pls, matrixCorr]);

  const analyses: Array<{ key: ExportKey; label: string; files: string[] }> = [
    { key: "procrustes", label: "Procrustes (aligned coords + centroid sizes)",
      files: ["procrustes/aligned_coordinates.csv", "procrustes/centroid_sizes.csv"] },
    { key: "pca",        label: "PCA (scores + eigenvalues)",
      files: ["pca/pc_scores.csv", "pca/eigenvalues.csv"] },
    { key: "cva",        label: "CVA (scores + Mahalanobis distances)",
      files: ["cva/cv_scores.csv", "cva/mahalanobis_distances.csv"] },
    { key: "lda",        label: "LDA / Cross-validation",
      files: ["lda/loo_predictions.csv", "lda/summary.csv"] },
    { key: "regression", label: "Regression (fitted + residuals)",
      files: ["regression/fitted.csv", "regression/residuals.csv", "regression/summary.csv"] },
    { key: "covariance", label: "Covariance matrix",
      files: ["covariance/covariance_matrix.csv"] },
    { key: "modularity", label: "Modularity (RV/CR + null distribution)",
      files: ["modularity/summary.csv", "modularity/null_distribution.csv"] },
    { key: "pls",        label: "Two-block PLS",
      files: ["pls/singular_values.csv", "pls/rv_summary.csv"] },
    { key: "matrixCorr", label: "Matrix Correlation (Mantel test)",
      files: ["matrix_corr/summary.csv", "matrix_corr/null_distribution.csv"] },
  ];

  const selectedReady = analyses.filter((a) => readiness[a.key] && selected.has(a.key));

  return (
    <PanelLayout
      title="Export Results"
      description="Select which analyses to write as CSV files"
      actions={
        <Button
          onClick={handleExport}
          disabled={exporting || selectedReady.length === 0 || !outputDir}
        >
          <Package size={14} />
          {exporting ? "Exporting…" : `Export ${selectedReady.length} selected`}
        </Button>
      }
    >
      <div className="flex h-full gap-4">
        {/* Left: analysis list with checkboxes */}
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
                <div className="flex items-center gap-2">
                  <Badge variant={readyKeys.length > 0 ? "default" : "secondary"}>
                    {readyKeys.length} / {analyses.length} ready
                  </Badge>
                  {readyKeys.length > 0 && (
                    <button
                      onClick={toggleAll}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {allReadySelected ? "Deselect all" : "Select all"}
                    </button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="divide-y">
                  {analyses.map((a) => {
                    const ready = readiness[a.key];
                    const checked = selected.has(a.key);
                    return (
                      <label
                        key={a.key}
                        className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${
                          ready ? "hover:bg-muted/40" : "opacity-40 cursor-not-allowed"
                        } ${checked && ready ? "bg-primary/5" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer disabled:cursor-not-allowed"
                          checked={checked && ready}
                          disabled={!ready}
                          onChange={() => ready && toggle(a.key)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{a.label}</span>
                            {!ready && (
                              <Badge variant="outline" className="text-[10px]">not run</Badge>
                            )}
                          </div>
                          <div className="mt-0.5 space-y-0.5">
                            {a.files.map((f) => (
                              <p key={f} className="font-mono text-xs text-muted-foreground">{f}</p>
                            ))}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right: folder + log */}
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
                  <FileDown size={14} className="text-emerald-500" /> Exported files
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
              <p>2. Check the ones you want to export</p>
              <p>3. Pick an output folder</p>
              <p>4. Click "Export selected"</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PanelLayout>
  );
}
