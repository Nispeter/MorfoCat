import type { Dataset } from "@/store/datasetStore";

/**
 * `.morfocat.json` project files: the dataset plus everything the user set up
 * around it (classifiers, wireframe, symmetry) and the Procrustes fit, so a
 * session can be put down and picked up later.
 */
export const PROJECT_VERSION = 1;
export const PROJECT_EXTENSION = "morfocat.json";

export interface ProjectAlignment {
  aligned: number[][][];
  consensus: number[][];
  centroid_sizes: number[];
  procrustes_distances: number[];
}

export interface ProjectFile {
  format: "morfocat-project";
  version: number;
  savedAt: string;
  dataset: Dataset;
  activeClassifier: string | null;
  wireframe: [number, number][];
  symPairs: [number, number][];
  midlineLms: number[];
  alignment: ProjectAlignment | null;
}

export function buildProject(
  input: Omit<ProjectFile, "format" | "version" | "savedAt">
): ProjectFile {
  return {
    format: "morfocat-project",
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    ...input,
  };
}

/** Parse and sanity-check a project file. Throws with a readable message. */
export function parseProject(text: string): ProjectFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Not a valid JSON file.");
  }

  const p = raw as Partial<ProjectFile>;
  if (p?.format !== "morfocat-project") {
    throw new Error("This is not a MorfoCat project file.");
  }
  if (typeof p.version !== "number" || p.version > PROJECT_VERSION) {
    throw new Error(`Project was saved by a newer version of MorfoCat (v${p.version}).`);
  }
  if (!p.dataset?.specimens?.length) {
    throw new Error("Project contains no specimens.");
  }

  return {
    format: "morfocat-project",
    version: p.version,
    savedAt: p.savedAt ?? "",
    dataset: p.dataset,
    activeClassifier: p.activeClassifier ?? null,
    wireframe: p.wireframe ?? [],
    symPairs: p.symPairs ?? [],
    midlineLms: p.midlineLms ?? [],
    alignment: p.alignment ?? null,
  };
}

/** Default file name for a project derived from the loaded dataset. */
export function defaultProjectName(filename: string): string {
  return `${filename.replace(/\.[^.]+$/, "") || "project"}.${PROJECT_EXTENSION}`;
}
