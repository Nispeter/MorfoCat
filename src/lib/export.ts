import { writeTextFile, ensureDir } from "./ipc";

// ── Browser-download helpers ──────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
}

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  triggerDownload(
    new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8;" }),
    filename.endsWith(".csv") ? filename : filename + ".csv"
  );
}

export function downloadJSON(filename: string, data: unknown) {
  triggerDownload(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    filename.endsWith(".json") ? filename : filename + ".json"
  );
}

/** Download the first <svg> found inside containerEl as an .svg file. */
export function downloadChartSVG(containerEl: Element | null, filename: string) {
  if (!containerEl) return;
  const svgEl = containerEl.tagName === "SVG" ? containerEl : containerEl.querySelector("svg");
  if (!svgEl) return;
  const blob = new Blob([new XMLSerializer().serializeToString(svgEl)], { type: "image/svg+xml" });
  triggerDownload(blob, filename.endsWith(".svg") ? filename : filename + ".svg");
}

// ── Disk export (writes to a folder chosen by the user) ───────────────────────

export interface ExportSources {
  dir: string;
  ids: string[];
  aligned?: number[][][] | null;
  centroid_sizes?: number[] | null;
  pca?: { scores: number[][]; eigenvalues: number[]; pct_variance: number[] } | null;
  cva?: {
    cv_scores: number[][];
    mahalanobis_distances: Array<{ group1: string; group2: string; distance: number }>;
  } | null;
  lda?: { loo_predictions: string[]; loo_accuracy: number } | null;
  regression?: { fitted: number[][]; residuals: number[][]; r_squared: number; p_value?: number } | null;
  covariance?: { covariance: number[][] } | null;
  modularity?: {
    rv_coefficient: number;
    cr_statistic: number;
    p_value_rv: number;
    p_value_cr: number;
    null_rv: number[];
    null_cr: number[];
  } | null;
  pls?: {
    singular_values: number[];
    pct_covariance: number[];
    rv_coefficient: number;
    p_value_sv1: number;
  } | null;
  matrixCorr?: { r: number; p_value: number; null_distribution: number[] } | null;
}

export async function exportAll(src: ExportSources): Promise<string[]> {
  const { dir, ids } = src;
  const log: string[] = [];

  async function save(sub: string, name: string, content: string) {
    await ensureDir(`${dir}/${sub}`);
    await writeTextFile(`${dir}/${sub}/${name}`, content);
    log.push(`${sub}/${name}`);
  }

  if (src.aligned && ids.length) {
    const dim = src.aligned[0]?.[0]?.length ?? 2;
    const lmH = src.aligned[0].flatMap((_, li) =>
      dim === 2
        ? [`lm${li + 1}_x`, `lm${li + 1}_y`]
        : [`lm${li + 1}_x`, `lm${li + 1}_y`, `lm${li + 1}_z`]
    );
    await save("procrustes", "aligned_coordinates.csv",
      toCsv(["id", ...lmH], src.aligned.map((sp, i) => [ids[i], ...sp.flat()])));
    if (src.centroid_sizes) {
      await save("procrustes", "centroid_sizes.csv",
        toCsv(["id", "centroid_size"], src.centroid_sizes.map((cs, i) => [ids[i], cs])));
    }
  }

  if (src.pca && ids.length) {
    const { scores, eigenvalues, pct_variance } = src.pca;
    const pcH = scores[0].map((_, i) => `PC${i + 1}`);
    await save("pca", "pc_scores.csv",
      toCsv(["id", ...pcH], scores.map((r, i) => [ids[i], ...r])));
    await save("pca", "eigenvalues.csv",
      toCsv(["PC", "eigenvalue", "pct_variance"],
        eigenvalues.map((e, i) => [i + 1, e, pct_variance[i]])));
  }

  if (src.cva && ids.length) {
    const { cv_scores, mahalanobis_distances } = src.cva;
    const cvH = cv_scores[0].map((_, i) => `CV${i + 1}`);
    await save("cva", "cv_scores.csv",
      toCsv(["id", ...cvH], cv_scores.map((r, i) => [ids[i], ...r])));
    await save("cva", "mahalanobis_distances.csv",
      toCsv(["group1", "group2", "mahalanobis_d"],
        mahalanobis_distances.map((d) => [d.group1, d.group2, d.distance])));
  }

  if (src.lda && ids.length) {
    await save("lda", "loo_predictions.csv",
      toCsv(["id", "predicted_group"],
        src.lda.loo_predictions.map((p, i) => [ids[i], p])));
    await save("lda", "summary.csv",
      toCsv(["metric", "value"], [["loo_accuracy", src.lda.loo_accuracy]]));
  }

  if (src.regression && ids.length) {
    const cols = src.regression.fitted[0]?.map((_, i) => `shape_var${i + 1}`) ?? [];
    await save("regression", "fitted.csv",
      toCsv(["id", ...cols], src.regression.fitted.map((r, i) => [ids[i], ...r])));
    await save("regression", "residuals.csv",
      toCsv(["id", ...cols], src.regression.residuals.map((r, i) => [ids[i], ...r])));
    await save("regression", "summary.csv",
      toCsv(["r_squared", "p_value"],
        [[src.regression.r_squared, src.regression.p_value ?? ""]]));
  }

  if (src.covariance) {
    const n = src.covariance.covariance.length;
    const varH = Array.from({ length: n }, (_, i) => `var${i + 1}`);
    await save("covariance", "covariance_matrix.csv",
      toCsv(["", ...varH],
        src.covariance.covariance.map((row, i) => [varH[i], ...row])));
  }

  if (src.modularity) {
    const { rv_coefficient, cr_statistic, p_value_rv, p_value_cr, null_rv, null_cr } = src.modularity;
    await save("modularity", "summary.csv",
      toCsv(["metric", "value", "p_value"],
        [["RV", rv_coefficient, p_value_rv], ["CR", cr_statistic, p_value_cr]]));
    await save("modularity", "null_distribution.csv",
      toCsv(["null_rv", "null_cr"], null_rv.map((v, i) => [v, null_cr[i]])));
  }

  if (src.pls) {
    const { singular_values, pct_covariance, rv_coefficient, p_value_sv1 } = src.pls;
    await save("pls", "singular_values.csv",
      toCsv(["dim", "singular_value", "pct_covariance"],
        singular_values.map((sv, i) => [i + 1, sv, pct_covariance[i]])));
    await save("pls", "rv_summary.csv",
      toCsv(["rv_coefficient", "p_value_sv1"], [[rv_coefficient, p_value_sv1]]));
  }

  if (src.matrixCorr) {
    const { r, p_value, null_distribution } = src.matrixCorr;
    await save("matrix_corr", "summary.csv",
      toCsv(["r", "p_value"], [[r, p_value]]));
    await save("matrix_corr", "null_distribution.csv",
      toCsv(["null_r"], null_distribution.map((v) => [v])));
  }

  return log;
}
