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
  /** Real-world units per pixel (length / pixel distance of the reference). */
  scale?: number;
  /** Unit label for the scale, e.g. "mm". */
  scaleUnit?: string;
}

/**
 * A TPS that lists images but carries no coordinates yet. It cannot start a
 * session on its own — the digitizer has to ask how many landmarks each
 * specimen gets first — so it waits here while the user is sent to that page.
 */
export interface PendingTemplate {
  specimens: DigitizerSpecimen[];
  dir: string;
  filePath: string;
}

/**
 * The part of a session worth writing to a project file. Landmarks are kept in
 * image pixels here, unlike the dataset's, which may have been multiplied by
 * each specimen's scale — that is why the session cannot be rebuilt from the
 * dataset and has to be saved in its own right.
 */
export interface DigitizerSnapshot {
  specimens: DigitizerSpecimen[];
  nLandmarks: number;
  nSemi: number;
  tpsDir: string;
  sourceFile: string;
}

interface DigitizerState {
  specimens: DigitizerSpecimen[];
  currentIdx: number;
  nLandmarks: number;
  nSemi: number;
  tpsDir: string;
  sourceFile: string;
  pendingTemplate: PendingTemplate | null;

  /** Null when no session is open, so saving a project stays cheap. */
  snapshot: () => DigitizerSnapshot | null;
  /** Null clears the session, so opening a project never leaves the old one. */
  restore: (snap: DigitizerSnapshot | null | undefined) => void;

  setSession: (
    specimens: DigitizerSpecimen[],
    nLandmarks: number,
    nSemi: number,
    tpsDir: string,
    sourceFile: string
  ) => void;
  /** Add more specimens to the session already open, skipping repeats. */
  appendSpecimens: (incoming: DigitizerSpecimen[]) => { added: number };
  setPendingTemplate: (template: PendingTemplate | null) => void;
  addLandmark: (x: number, y: number, isSemi: boolean) => void;
  undoLandmark: () => void;
  clearSpecimen: () => void;
  setScale: (scale: number, unit: string) => void;
  navigate: (idx: number) => void;
  reset: () => void;
}

export const useDigitizerStore = create<DigitizerState>((set, get) => ({
  specimens: [],
  currentIdx: 0,
  nLandmarks: 0,
  nSemi: 0,
  tpsDir: "",
  sourceFile: "",
  pendingTemplate: null,

  setSession: (specimens, nLandmarks, nSemi, tpsDir, sourceFile) =>
    set({ specimens, nLandmarks, nSemi, tpsDir, sourceFile, currentIdx: 0 }),

  appendSpecimens: (incoming) => {
    const { specimens } = get();
    // The image path is the identity here: the same photo added twice would
    // otherwise become two specimens digitized independently.
    const seen = new Set(specimens.map((sp) => sp.imagePath || sp.imageBase));
    const fresh = incoming.filter((sp) => !seen.has(sp.imagePath || sp.imageBase));
    if (fresh.length > 0) set({ specimens: [...specimens, ...fresh] });
    return { added: fresh.length };
  },

  setPendingTemplate: (pendingTemplate) => set({ pendingTemplate }),

  snapshot: () => {
    const { specimens, nLandmarks, nSemi, tpsDir, sourceFile } = get();
    if (specimens.length === 0) return null;
    return { specimens, nLandmarks, nSemi, tpsDir, sourceFile };
  },

  restore: (snap) => {
    if (!snap || !snap.specimens?.length) {
      set({
        specimens: [], currentIdx: 0, nLandmarks: 0, nSemi: 0,
        tpsDir: "", sourceFile: "", pendingTemplate: null,
      });
      return;
    }
    set({
      specimens: snap.specimens,
      nLandmarks: snap.nLandmarks,
      nSemi: snap.nSemi ?? 0,
      tpsDir: snap.tpsDir ?? "",
      sourceFile: snap.sourceFile ?? "",
      currentIdx: 0,
      pendingTemplate: null,
    });
  },

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

  setScale: (scale, unit) =>
    set((s) => {
      const sp = s.specimens[s.currentIdx];
      if (!sp) return s;
      const specimens = [...s.specimens];
      specimens[s.currentIdx] = { ...sp, scale, scaleUnit: unit };
      return { specimens };
    }),

  navigate: (idx) =>
    set((s) => ({ currentIdx: Math.max(0, Math.min(idx, s.specimens.length - 1)) })),

  reset: () =>
    set({
      specimens: [], currentIdx: 0, nLandmarks: 0, nSemi: 0,
      tpsDir: "", sourceFile: "", pendingTemplate: null,
    }),
}));
