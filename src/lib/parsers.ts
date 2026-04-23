import type { ParsedDataset } from "./ipc";

export interface TpsSpecimen {
  id?: string | null;
  image?: string | null;
  scale?: number | null;
  landmarks: number[][];
  semiLandmarkIndices?: number[];
}

/** Serialize specimens to TPS text, writing SLIDERS= for any semilandmarks. */
export function writeTPS(specimens: TpsSpecimen[]): string {
  const lines: string[] = [];
  for (const sp of specimens) {
    if (sp.image) lines.push(`IMAGE=${sp.image}`);
    lines.push(`LM=${sp.landmarks.length}`);
    for (const pt of sp.landmarks) {
      lines.push(pt.map((v) => v.toFixed(6)).join(" "));
    }
    if (sp.id != null) lines.push(`ID=${sp.id}`);
    if (sp.scale != null) lines.push(`SCALE=${sp.scale.toFixed(6)}`);
    if (sp.semiLandmarkIndices && sp.semiLandmarkIndices.length >= 2) {
      const si = sp.semiLandmarkIndices;
      // SLIDERS rows: before, slider, after — build a chain
      const sliders: string[] = [];
      for (let k = 0; k < si.length; k++) {
        const before = k === 0 ? si[0] : si[k - 1];
        const after = k === si.length - 1 ? si[si.length - 1] : si[k + 1];
        sliders.push(`${before + 1} ${si[k] + 1} ${after + 1}`);
      }
      lines.push(`SLIDERS=${si.length}`);
      lines.push(...sliders);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function parseTPS(content: string): ParsedDataset {
  type Specimen = { landmarks: number[][]; id: string | null; scale: number | null; image: string | null };

  const specimens: Specimen[] = [];
  let current: Specimen | null = null;
  let lmCount = 0;
  let collected = 0;
  const pending: { id?: string; scale?: number; image?: string } = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const keyMatch = line.match(/^\*?([A-Z_]+)=(.*)$/i);
    if (keyMatch) {
      const key = keyMatch[1].toUpperCase();
      const val = keyMatch[2].trim();

      if (key === "LM") {
        if (current !== null) specimens.push(current);
        current = {
          landmarks: [],
          id: pending.id ?? null,
          scale: pending.scale ?? null,
          image: pending.image ?? null,
        };
        delete pending.id;
        delete pending.scale;
        delete pending.image;
        lmCount = parseInt(val, 10);
        collected = 0;
      } else if (key === "ID") {
        if (current !== null) current.id = val;
        else pending.id = val;
      } else if (key === "IMAGE") {
        if (current !== null) current.image = val;
        else pending.image = val;
      } else if (key === "SCALE") {
        const f = parseFloat(val);
        if (!isNaN(f)) {
          if (current !== null) current.scale = f;
          else pending.scale = f;
        }
      }
      // silently skip CURVES and other keys
    } else if (current !== null && collected < lmCount) {
      const coords = line.split(/\s+/).map(Number);
      if (coords.some(isNaN)) continue;
      current.landmarks.push(coords);
      collected++;
    }
  }

  if (current !== null) specimens.push(current);

  if (specimens.length === 0) throw new Error("No specimens found in TPS file.");

  const nLm = specimens[0].landmarks.length;
  if (nLm === 0) throw new Error("First specimen has no landmark coordinates.");
  const dim = specimens[0].landmarks[0].length;

  for (let i = 0; i < specimens.length; i++) {
    if (specimens[i].landmarks.length !== nLm) {
      throw new Error(`Specimen ${i} has ${specimens[i].landmarks.length} landmarks; expected ${nLm}.`);
    }
  }

  return {
    specimens: specimens.map((sp) => ({
      id: sp.id,
      scale: sp.scale,
      image: sp.image,
      landmarks: sp.landmarks,
    })),
    n_landmarks: nLm,
    dimensions: dim,
  };
}

export function parseNTS(content: string): ParsedDataset {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error("Empty NTS file.");

  // First non-comment line is the header
  let headerIdx = 0;
  while (headerIdx < lines.length && lines[headerIdx].startsWith("'")) headerIdx++;

  const header = lines[headerIdx].split(/[\s,]+/);
  const n = parseInt(header[0], 10); // specimens
  const p = parseInt(header[1], 10); // landmarks
  const k = parseInt(header[2], 10); // dimensions
  // missFlag (header[4]) reserved for future missing-value handling

  if (isNaN(n) || isNaN(p) || isNaN(k)) throw new Error("Cannot parse NTS header.");

  const allNums: number[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith("'")) continue;
    for (const tok of lines[i].split(/[\s,]+/)) {
      if (tok === "") continue;
      allNums.push(parseFloat(tok));
    }
  }

  const specimens: ParsedDataset["specimens"] = [];
  for (let s = 0; s < n; s++) {
    const landmarks: number[][] = [];
    for (let lm = 0; lm < p; lm++) {
      const coords: number[] = [];
      for (let d = 0; d < k; d++) {
        coords.push(allNums[s * p * k + lm * k + d]);
      }
      landmarks.push(coords);
    }
    specimens.push({ id: `${s + 1}`, scale: null, image: null, landmarks });
  }

  return { specimens, n_landmarks: p, dimensions: k };
}

export function parseMorphologika(content: string): ParsedDataset {
  const lines = content.split(/\r?\n/).map((l) => l.trim());

  function readTag(tag: string): string | null {
    const idx = lines.findIndex((l) => l.toLowerCase() === `[${tag.toLowerCase()}]`);
    if (idx === -1) return null;
    return lines[idx + 1] ?? null;
  }

  function readTagLines(tag: string, count: number): string[] {
    const idx = lines.findIndex((l) => l.toLowerCase() === `[${tag.toLowerCase()}]`);
    if (idx === -1) return [];
    return lines.slice(idx + 1, idx + 1 + count);
  }

  const nStr = readTag("individuals");
  const lmStr = readTag("landmarks");
  const dimStr = readTag("dimensions");

  if (!nStr || !lmStr || !dimStr) throw new Error("Missing required Morphologika headers ([individuals], [landmarks], [dimensions]).");

  const n = parseInt(nStr, 10);
  const p = parseInt(lmStr, 10);
  const k = parseInt(dimStr, 10);

  if (isNaN(n) || isNaN(p) || isNaN(k)) throw new Error("Cannot parse Morphologika header values.");

  // Read labels if present
  const labelLines = readTagLines("labels", n);
  const hasLabels = labelLines.length === n && !labelLines[0].match(/^-?\d/);

  // Find [rawpoints] section
  const rawIdx = lines.findIndex((l) => l.toLowerCase() === "[rawpoints]");
  if (rawIdx === -1) throw new Error("No [rawpoints] section found.");

  const specimens: ParsedDataset["specimens"] = [];
  let linePtr = rawIdx + 1;

  for (let s = 0; s < n; s++) {
    // skip optional specimen label line
    if (linePtr < lines.length && lines[linePtr].startsWith("'")) linePtr++;
    const landmarks: number[][] = [];
    for (let lm = 0; lm < p; lm++) {
      const row = lines[linePtr++] ?? "";
      const coords = row.split(/\s+/).map(Number);
      landmarks.push(coords);
    }
    specimens.push({
      id: hasLabels ? (labelLines[s] ?? `${s + 1}`) : `${s + 1}`,
      scale: null,
      image: null,
      landmarks,
    });
  }

  return { specimens, n_landmarks: p, dimensions: k };
}
