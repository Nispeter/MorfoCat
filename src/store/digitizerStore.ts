import { create } from "zustand";

export interface LandmarkPoint {
  x: number;
  y: number;
  isSemi: boolean;
}

export interface DigitizerSpecimen {
  id: string;
  imagePath: string;
  imageBase: string;
  landmarks: LandmarkPoint[];
}

interface DigitizerState {
  specimens: DigitizerSpecimen[];
  currentIdx: number;
  nLandmarks: number;
  nSemi: number;
  tpsDir: string;
  sourceFile: string;

  setSession: (
    specimens: DigitizerSpecimen[],
    nLandmarks: number,
    nSemi: number,
    tpsDir: string,
    sourceFile: string
  ) => void;
  addLandmark: (x: number, y: number, isSemi: boolean) => void;
  undoLandmark: () => void;
  clearSpecimen: () => void;
  navigate: (idx: number) => void;
  reset: () => void;
}

export const useDigitizerStore = create<DigitizerState>((set) => ({
  specimens: [],
  currentIdx: 0,
  nLandmarks: 0,
  nSemi: 0,
  tpsDir: "",
  sourceFile: "",

  setSession: (specimens, nLandmarks, nSemi, tpsDir, sourceFile) =>
    set({ specimens, nLandmarks, nSemi, tpsDir, sourceFile, currentIdx: 0 }),

  addLandmark: (x, y, isSemi) =>
    set((s) => {
      const sp = s.specimens[s.currentIdx];
      if (!sp || sp.landmarks.length >= s.nLandmarks) return s;
      const specimens = [...s.specimens];
      specimens[s.currentIdx] = { ...sp, landmarks: [...sp.landmarks, { x, y, isSemi }] };
      return { specimens };
    }),

  undoLandmark: () =>
    set((s) => {
      const sp = s.specimens[s.currentIdx];
      if (!sp || sp.landmarks.length === 0) return s;
      const specimens = [...s.specimens];
      specimens[s.currentIdx] = { ...sp, landmarks: sp.landmarks.slice(0, -1) };
      return { specimens };
    }),

  clearSpecimen: () =>
    set((s) => {
      const specimens = [...s.specimens];
      specimens[s.currentIdx] = { ...specimens[s.currentIdx], landmarks: [] };
      return { specimens };
    }),

  navigate: (idx) =>
    set((s) => ({ currentIdx: Math.max(0, Math.min(idx, s.specimens.length - 1)) })),

  reset: () => set({ specimens: [], currentIdx: 0, nLandmarks: 0, nSemi: 0, tpsDir: "", sourceFile: "" }),
}));
