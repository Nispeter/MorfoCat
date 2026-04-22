import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentFile {
  name: string;
  format: string;
  content: string;
  timestamp: number;
}

interface RecentFilesState {
  files: RecentFile[];
  addRecentFile: (file: Omit<RecentFile, "timestamp">) => void;
  removeRecentFile: (name: string) => void;
  clearRecent: () => void;
}

const MAX_RECENT = 8;

export const useRecentFilesStore = create<RecentFilesState>()(
  persist(
    (set) => ({
      files: [],
      addRecentFile: (file) =>
        set((s) => {
          const filtered = s.files.filter((f) => f.name !== file.name);
          return {
            files: [{ ...file, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT),
          };
        }),
      removeRecentFile: (name) =>
        set((s) => ({ files: s.files.filter((f) => f.name !== name) })),
      clearRecent: () => set({ files: [] }),
    }),
    { name: "morfocat-recent-files" }
  )
);
