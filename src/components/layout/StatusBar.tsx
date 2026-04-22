import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";

export function StatusBar() {
  const dataset = useDatasetStore((s) => s.dataset);
  const aligned = useDatasetStore((s) => s.aligned);
  const { pca, cva, lda, regression, pls, modularity, matrixCorr } = useAnalysisStore();

  if (!dataset) return null;

  const included = dataset.specimens.filter((s) => s.include).length;
  const total = dataset.specimens.length;

  const done: string[] = [];
  if (aligned) done.push("GPA");
  if (pca) done.push("PCA");
  if (cva) done.push("CVA");
  if (lda) done.push("LDA");
  if (regression) done.push("Regression");
  if (pls) done.push("PLS");
  if (modularity) done.push("Modularity");
  if (matrixCorr) done.push("MatCorr");

  return (
    <div className="flex h-7 shrink-0 items-center gap-4 border-t bg-muted/40 px-4 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground/70">{dataset.filename}</span>
      <Sep />
      <span>{total} specimens{included < total ? ` (${included} included)` : ""}</span>
      <Sep />
      <span>{dataset.n_landmarks} landmarks · {dataset.dimensions}D</span>
      {done.length > 0 && (
        <>
          <Sep />
          <span className="text-emerald-600 dark:text-emerald-400">
            {done.join(" · ")} ✓
          </span>
        </>
      )}
    </div>
  );
}

function Sep() {
  return <span className="opacity-30">|</span>;
}
