import { create } from "zustand";

type UiState = {
  breakdownOpen: boolean;
  breakdownMonth: string | null;
  openBreakdown: (month?: string | null) => void;
  closeBreakdown: () => void;
  setBreakdownMonth: (month: string | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  breakdownOpen: false,
  breakdownMonth: null,
  openBreakdown: (month) =>
    set({
      breakdownOpen: true,
      breakdownMonth: month ?? null,
    }),
  closeBreakdown: () => set({ breakdownOpen: false }),
  setBreakdownMonth: (month) => set({ breakdownMonth: month }),
}));
