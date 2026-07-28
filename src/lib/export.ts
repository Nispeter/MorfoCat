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
