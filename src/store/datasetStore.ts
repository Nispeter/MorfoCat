import { create } from "zustand";

export interface Specimen {
  id: string;
  landmarks: number[][];
  scale?: number | null;
  image?: string | null;
  group?: string;
  include: boolean;
}

export interface Dataset {
  specimens: Specimen[];
  n_landmarks: number;
  dimensions: number;
  filename: string;
}

interface DatasetState {
  dataset: Dataset | null;
  aligned: number[][][] | null;
  consensus: number[][] | null;
  centroid_sizes: number[] | null;
  procrustes_distances: number[] | null;

  setDataset: (ds: Dataset) => void;
  setAligned: (
    aligned: number[][][],
    consensus: number[][],
    centroid_sizes: number[],
    procrustes_distances: number[]
  ) => void;
  toggleSpecimen: (idx: number) => void;
  setGroup: (idx: number, group: string) => void;
  clear: () => void;
}

export const useDatasetStore = create<DatasetState>((set) => ({
  dataset: null,
  aligned: null,
  consensus: null,
  centroid_sizes: null,
  procrustes_distances: null,

  setDataset: (ds) => set({ dataset: ds, aligned: null, consensus: null, centroid_sizes: null, procrustes_distances: null }),

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

  clear: () =>
    set({ dataset: null, aligned: null, consensus: null, centroid_sizes: null, procrustes_distances: null }),
}));
