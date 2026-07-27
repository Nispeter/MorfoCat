import { create } from "zustand";

export interface Specimen {
  id: string;
  landmarks: number[][];
  scale?: number | null;
  image?: string | null;
  group?: string;
  /** Named classifiers extracted from the ID string (e.g. { site: "PR", material: "obsidian" }). */
  classifiers?: Record<string, string>;
  include: boolean;
}

export interface Dataset {
  specimens: Specimen[];
  n_landmarks: number;
  dimensions: number;
  filename: string;
  /** Ordered list of defined classifier names. */
  classifierNames?: string[];
}

interface DatasetState {
  dataset: Dataset | null;
  aligned: number[][][] | null;
  consensus: number[][] | null;
  centroid_sizes: number[] | null;
  procrustes_distances: number[] | null;
  /** Name of the classifier currently used for grouping/coloring, or null. */
  activeClassifier: string | null;
  /** User-defined wireframe: pairs of 0-based landmark indices to connect. */
  wireframe: [number, number][];
  /** Bilaterally paired landmarks (0-based) used when object symmetry is enabled. */
  symPairs: [number, number][];
  /** Midline landmarks (0-based) — reflected onto themselves under object symmetry. */
  midlineLms: number[];

  setDataset: (ds: Dataset) => void;
  setAligned: (
    aligned: number[][][],
    consensus: number[][],
    centroid_sizes: number[],
    procrustes_distances: number[]
  ) => void;
  toggleSpecimen: (idx: number) => void;
  setGroup: (idx: number, group: string) => void;
  extractClassifier: (name: string, first: number, last: number) => void;
  setSpecimenClassifier: (idx: number, name: string, value: string) => void;
  renameClassifier: (oldName: string, newName: string) => void;
  deleteClassifier: (name: string) => void;
  setActiveClassifier: (name: string | null) => void;
  addLink: (a: number, b: number) => void;
  removeLink: (index: number) => void;
  clearWireframe: () => void;
  addSymPair: (a: number, b: number) => void;
  removeSymPair: (index: number) => void;
  toggleMidline: (i: number) => void;
  clearSymmetry: () => void;
  swapLandmarks: (i: number, j: number) => void;
  subsetLandmarks: (keep: number[]) => { kept: number } | { error: string };
  averageByClassifier: (name: string) => { groups: number } | { error: string };
  appendSpecimens: (specimens: Specimen[]) => { added: number } | { error: string };
  clear: () => void;
}

export const useDatasetStore = create<DatasetState>((set, get) => ({
  dataset: null,
  aligned: null,
  consensus: null,
  centroid_sizes: null,
  procrustes_distances: null,
  activeClassifier: null,
  wireframe: [],
  symPairs: [],
  midlineLms: [],

  setDataset: (ds) => {
    // Seed a "group" classifier from any auto-detected group so existing
    // grouping keeps working and shows up in the classifier UI.
    const hasGroup = ds.specimens.some((sp) => sp.group);
    const specimens = ds.specimens.map((sp) =>
      sp.group ? { ...sp, classifiers: { group: sp.group, ...(sp.classifiers ?? {}) } } : sp
    );
    const classifierNames = hasGroup ? ["group"] : [];
    set({
      dataset: { ...ds, specimens, classifierNames },
      aligned: null,
      consensus: null,
      centroid_sizes: null,
      procrustes_distances: null,
      activeClassifier: hasGroup ? "group" : null,
      wireframe: [],
      symPairs: [],
      midlineLms: [],
    });
  },

  setAligned: (aligned, consensus, centroid_sizes, procrustes_distances) =>
    set({ aligned, consensus, centroid_sizes, procrustes_distances }),

  toggleSpecimen: (idx) =>
    set((s) => {
      if (!s.dataset) return s;
      const specimens = [...s.dataset.specimens];
      specimens[idx] = { ...specimens[idx], include: !specimens[idx].include };
      return { dataset: { ...s.dataset, specimens } };
    }),

  setGroup: (idx, group) =>
    set((s) => {
      if (!s.dataset) return s;
      const specimens = [...s.dataset.specimens];
      specimens[idx] = { ...specimens[idx], group };
      return { dataset: { ...s.dataset, specimens } };
    }),

  extractClassifier: (name, first, last) =>
    set((s) => {
      if (!s.dataset || !name.trim()) return s;
      const key = name.trim();
      const lo = Math.max(0, first - 1);
      const specimens = s.dataset.specimens.map((sp) => ({
        ...sp,
        classifiers: { ...(sp.classifiers ?? {}), [key]: sp.id.slice(lo, last) },
      }));
      const classifierNames = s.dataset.classifierNames?.includes(key)
        ? s.dataset.classifierNames
        : [...(s.dataset.classifierNames ?? []), key];
      return {
        dataset: { ...s.dataset, specimens, classifierNames },
        activeClassifier: s.activeClassifier ?? key,
      };
    }),

  setSpecimenClassifier: (idx, name, value) =>
    set((s) => {
      if (!s.dataset) return s;
      const specimens = [...s.dataset.specimens];
      specimens[idx] = {
        ...specimens[idx],
        classifiers: { ...(specimens[idx].classifiers ?? {}), [name]: value },
      };
      return { dataset: { ...s.dataset, specimens } };
    }),

  renameClassifier: (oldName, newName) =>
    set((s) => {
      if (!s.dataset || !newName.trim() || oldName === newName) return s;
      const key = newName.trim();
      const specimens = s.dataset.specimens.map((sp) => {
        if (!sp.classifiers || !(oldName in sp.classifiers)) return sp;
        const { [oldName]: val, ...rest } = sp.classifiers;
        return { ...sp, classifiers: { ...rest, [key]: val } };
      });
      const classifierNames = (s.dataset.classifierNames ?? []).map((n) => (n === oldName ? key : n));
      return {
        dataset: { ...s.dataset, specimens, classifierNames },
        activeClassifier: s.activeClassifier === oldName ? key : s.activeClassifier,
      };
    }),

  deleteClassifier: (name) =>
    set((s) => {
      if (!s.dataset) return s;
      const specimens = s.dataset.specimens.map((sp) => {
        if (!sp.classifiers || !(name in sp.classifiers)) return sp;
        const { [name]: _drop, ...rest } = sp.classifiers;
        return { ...sp, classifiers: rest };
      });
      const classifierNames = (s.dataset.classifierNames ?? []).filter((n) => n !== name);
      return {
        dataset: { ...s.dataset, specimens, classifierNames },
        activeClassifier: s.activeClassifier === name ? (classifierNames[0] ?? null) : s.activeClassifier,
      };
    }),

  setActiveClassifier: (name) => set({ activeClassifier: name }),

  addLink: (a, b) =>
    set((s) => {
      if (a === b) return s;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      const exists = s.wireframe.some(([x, y]) => (x < y ? `${x}-${y}` : `${y}-${x}`) === key);
      if (exists) return s;
      return { wireframe: [...s.wireframe, [a, b]] };
    }),

  removeLink: (index) =>
    set((s) => ({ wireframe: s.wireframe.filter((_, i) => i !== index) })),

  clearWireframe: () => set({ wireframe: [] }),

  // A landmark belongs to at most one symmetric pair and cannot also be midline.
  addSymPair: (a, b) =>
    set((s) => {
      if (a === b) return s;
      const taken = new Set(s.symPairs.flat());
      if (taken.has(a) || taken.has(b)) return s;
      return {
        symPairs: [...s.symPairs, [a, b]],
        midlineLms: s.midlineLms.filter((m) => m !== a && m !== b),
      };
    }),

  removeSymPair: (index) =>
    set((s) => ({ symPairs: s.symPairs.filter((_, i) => i !== index) })),

  toggleMidline: (i) =>
    set((s) => {
      if (s.midlineLms.includes(i)) {
        return { midlineLms: s.midlineLms.filter((m) => m !== i) };
      }
      if (s.symPairs.some(([a, b]) => a === i || b === i)) return s;
      return { midlineLms: [...s.midlineLms, i].sort((x, y) => x - y) };
    }),

  clearSymmetry: () => set({ symPairs: [], midlineLms: [] }),

  // Swap two landmarks across every specimen. Keeps the wireframe consistent by
  // remapping the swapped indices, and clears stale alignment so analyses re-run.
  swapLandmarks: (i, j) =>
    set((s) => {
      if (!s.dataset || i === j) return s;
      const specimens = s.dataset.specimens.map((sp) => {
        const lms = [...sp.landmarks];
        if (lms[i] && lms[j]) [lms[i], lms[j]] = [lms[j], lms[i]];
        return { ...sp, landmarks: lms };
      });
      const remap = (n: number) => (n === i ? j : n === j ? i : n);
      const wireframe = s.wireframe.map(([a, b]) => [remap(a), remap(b)] as [number, number]);
      return {
        dataset: { ...s.dataset, specimens },
        wireframe,
        aligned: null,
        consensus: null,
        centroid_sizes: null,
        procrustes_distances: null,
      };
    }),

  // Keep only the given landmarks (0-based, any order) across every specimen.
  // Links, symmetric pairs and midline landmarks are renumbered; anything that
  // referenced a dropped landmark is discarded.
  subsetLandmarks: (keep) => {
    const s = get();
    if (!s.dataset) return { error: "No dataset loaded." };
    const ordered = [...new Set(keep)].sort((a, b) => a - b);
    if (ordered.length < 3) return { error: "Keep at least 3 landmarks." };
    if (ordered.length === s.dataset.n_landmarks) return { error: "Nothing to remove." };

    const newIdx = new Map(ordered.map((old, i) => [old, i]));
    const remap = ([a, b]: [number, number]): [number, number] | null => {
      const na = newIdx.get(a), nb = newIdx.get(b);
      return na == null || nb == null ? null : [na, nb];
    };

    set({
      dataset: {
        ...s.dataset,
        specimens: s.dataset.specimens.map((sp) => ({
          ...sp,
          landmarks: ordered.map((i) => sp.landmarks[i]),
        })),
        n_landmarks: ordered.length,
      },
      wireframe: s.wireframe.map(remap).filter((e): e is [number, number] => e !== null),
      symPairs: s.symPairs.map(remap).filter((e): e is [number, number] => e !== null),
      midlineLms: s.midlineLms.map((m) => newIdx.get(m)).filter((m): m is number => m != null),
      aligned: null,
      consensus: null,
      centroid_sizes: null,
      procrustes_distances: null,
    });
    return { kept: ordered.length };
  },

  // Collapse the sample to one averaged specimen per classifier value
  // (MorphoJ's "average by …"). Only included specimens contribute.
  averageByClassifier: (name) => {
    const s = get();
    if (!s.dataset) return { error: "No dataset loaded." };
    const included = s.dataset.specimens.filter((sp) => sp.include);
    if (!included.length) return { error: "No specimens are included." };

    const buckets = new Map<string, Specimen[]>();
    for (const sp of included) {
      const key = sp.classifiers?.[name] ?? sp.group ?? "unassigned";
      const bucket = buckets.get(key);
      bucket ? bucket.push(sp) : buckets.set(key, [sp]);
    }
    if (buckets.size < 2) return { error: `"${name}" has only one value — nothing to average.` };

    const nDim = s.dataset.dimensions;
    const specimens: Specimen[] = [...buckets.entries()].map(([key, members]) => ({
      id: key,
      landmarks: Array.from({ length: s.dataset!.n_landmarks }, (_, li) =>
        Array.from({ length: nDim }, (_, d) =>
          members.reduce((sum, sp) => sum + (sp.landmarks[li]?.[d] ?? 0), 0) / members.length
        )
      ),
      group: key,
      classifiers: { [name]: key },
      include: true,
    }));

    set({
      dataset: { ...s.dataset, specimens, classifierNames: [name] },
      activeClassifier: name,
      aligned: null,
      consensus: null,
      centroid_sizes: null,
      procrustes_distances: null,
    });
    return { groups: specimens.length };
  },

  // Append specimens from another file. Requires the same landmark count.
  appendSpecimens: (incoming) => {
    const s = get();
    if (!s.dataset) return { error: "No dataset loaded." };
    const nLm = s.dataset.n_landmarks;
    const mismatch = incoming.find((sp) => sp.landmarks.length !== nLm);
    if (mismatch) {
      return { error: `Landmark count differs (${mismatch.landmarks.length} vs ${nLm}). Files must share the same landmark scheme.` };
    }
    const existingIds = new Set(s.dataset.specimens.map((sp) => sp.id));
    const merged = incoming.map((sp) => {
      let id = sp.id;
      let k = 2;
      while (existingIds.has(id)) id = `${sp.id} (${k++})`;
      existingIds.add(id);
      return { ...sp, id };
    });
    set({
      dataset: { ...s.dataset, specimens: [...s.dataset.specimens, ...merged] },
      aligned: null,
      consensus: null,
      centroid_sizes: null,
      procrustes_distances: null,
    });
    return { added: merged.length };
  },

  clear: () =>
    set({ dataset: null, aligned: null, consensus: null, centroid_sizes: null, procrustes_distances: null, activeClassifier: null, wireframe: [], symPairs: [], midlineLms: [] }),
}));
