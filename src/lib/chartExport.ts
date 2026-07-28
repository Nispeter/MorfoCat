/**
 * Export any on-screen chart as a standalone SVG or a high-resolution PNG.
 *
 * Charts are styled with CSS variables and Tailwind classes, neither of which
 * survive outside the document, so every drawn element gets its resolved paint
 * and font baked in before serialization.
 */

const COPIED_PROPS = [
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity",
  "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity",
  "font-family", "font-size", "font-weight", "font-style", "text-anchor",
  "dominant-baseline", "letter-spacing",
] as const;

function inlineStyles(source: Element, clone: Element) {
  const srcNodes = [source, ...Array.from(source.querySelectorAll("*"))];
  const dstNodes = [clone, ...Array.from(clone.querySelectorAll("*"))];

  srcNodes.forEach((node, i) => {
    const dst = dstNodes[i];
    if (!dst || !(node instanceof Element)) return;
    const computed = window.getComputedStyle(node);
    let css = "";
    for (const prop of COPIED_PROPS) {
      const value = computed.getPropertyValue(prop);
      if (value && value !== "none" && value !== "normal") css += `${prop}:${value};`;
    }
    if (css) dst.setAttribute("style", css);
    dst.removeAttribute("class");
  });
}

/** Serialize the first <svg> inside `container` into standalone SVG markup. */
function serialize(container: Element, background: string | null): string | null {
  const svg = container.tagName.toLowerCase() === "svg" ? container : container.querySelector("svg");
  if (!svg) return null;

  const rect = svg.getBoundingClientRect();
  const width = Math.ceil(rect.width) || 600;
  const height = Math.ceil(rect.height) || 400;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${width} ${height}`);

  if (background) {
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", background);
    clone.insertBefore(bg, clone.firstChild);
  }

  return new XMLSerializer().serializeToString(clone);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Render the chart in the light theme regardless of what the app is using.
 *
 * Figures end up in papers and slides on white paper, so a dark-theme export
 * would be unusable. The document is switched to the light theme for the
 * duration of the capture and put back afterwards; it is synchronous, so no
 * repaint happens in between and the flip is invisible.
 */
function withLightTheme<T>(fn: () => T): T {
  const root = document.documentElement;
  const hadDark = root.classList.contains("dark");
  const previousTheme = root.getAttribute("data-theme");

  // Dropping both the dark class and the theme attribute falls back to the
  // neutral light palette, which reads better in print than a tinted theme.
  root.classList.remove("dark");
  root.removeAttribute("data-theme");
  try {
    return fn();
  } finally {
    if (hadDark) root.classList.add("dark");
    if (previousTheme === null) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", previousTheme);
  }
}

/** Card surface of the light theme — the background exported figures sit on. */
const EXPORT_BACKGROUND = "#ffffff";

export type ChartFormat = "svg" | "png";

/**
 * Write the chart inside `container` to disk. PNG is rendered at `scale`×
 * the on-screen size so figures stay sharp in print.
 */
export async function exportChart(
  container: Element | null,
  filename: string,
  format: ChartFormat,
  scale = 3
): Promise<void> {
  if (!container) throw new Error("Nothing to export.");
  const background = EXPORT_BACKGROUND;
  // Styles are read off the live DOM, so the theme must be light while the
  // colours are being inlined — not merely when the PNG is painted.
  const markup = withLightTheme(() => serialize(container, background));
  if (!markup) throw new Error("No chart found to export.");

  const base = filename.replace(/\.(svg|png)$/i, "");

  if (format === "svg") {
    triggerDownload(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }), `${base}.svg`);
    return;
  }

  // Base64 data URL keeps the canvas untainted, so toBlob() stays allowed.
  const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(markup)))}`;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not rasterize the chart."));
    img.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not encode the PNG.");
  triggerDownload(blob, `${base}.png`);
}
