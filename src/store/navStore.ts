import { create } from "zustand";
import type { PageId } from "@/components/layout/Sidebar";

interface NavState {
  activePage: PageId;
  navigate: (id: PageId) => void;
}

export const useNavStore = create<NavState>((set) => ({
  activePage: "data",
  navigate: (id) => set({ activePage: id }),
}));
