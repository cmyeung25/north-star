import { create } from "zustand";
import type { WorkspaceMode } from "../../lib/scenario/lifecycle";

type DrawerType = "smartInvest";
type ModalType = "monthlyBreakdown";
type ModalFocus = "cashflow" | "networth";

type ActiveDrawer = {
  type: DrawerType;
  nonce: number;
};

type ActiveModal = {
  type: ModalType;
  month?: string | null;
  focus?: ModalFocus;
  nonce: number;
};

type UiState = {
  workspaceMode: WorkspaceMode;
  activeDrawer: ActiveDrawer | null;
  activeModal: ActiveModal | null;
  breakdownOpen: boolean;
  breakdownMonth: string | null;
  breakdownMonthRange: { fromMonth: string | null; toMonth: string | null };
  openDrawer: (type: DrawerType) => void;
  closeDrawer: () => void;
  openModal: (
    type: ModalType,
    payload?: { month?: string | null; focus?: ModalFocus }
  ) => void;
  closeModal: () => void;
  openBreakdown: (month?: string | null) => void;
  closeBreakdown: () => void;
  setBreakdownMonth: (month: string | null) => void;
  setBreakdownMonthRange: (range: { fromMonth: string | null; toMonth: string | null }) => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
};

export const useUiStore = create<UiState>((set) => ({
  workspaceMode: "core",
  activeDrawer: null,
  activeModal: null,
  breakdownOpen: false,
  breakdownMonth: null,
  breakdownMonthRange: { fromMonth: null, toMonth: null },
  openDrawer: (type) =>
    set((state) => ({
      activeDrawer: {
        type,
        nonce: (state.activeDrawer?.nonce ?? 0) + 1,
      },
    })),
  closeDrawer: () => set({ activeDrawer: null }),
  openModal: (type, payload) =>
    set((state) => {
      const nextMonth = payload?.month ?? state.breakdownMonth ?? null;
      return {
        activeModal: {
          type,
          month: nextMonth,
          focus: payload?.focus,
          nonce: (state.activeModal?.nonce ?? 0) + 1,
        },
        breakdownOpen: type === "monthlyBreakdown",
        breakdownMonth: nextMonth,
      };
    }),
  closeModal: () => set({ activeModal: null, breakdownOpen: false }),
  openBreakdown: (month) =>
    set((state) => ({
      breakdownOpen: true,
      breakdownMonth: month ?? null,
      activeModal: {
        type: "monthlyBreakdown",
        month: month ?? null,
        focus: "cashflow",
        nonce: (state.activeModal?.nonce ?? 0) + 1,
      },
    })),
  closeBreakdown: () => set({ breakdownOpen: false, activeModal: null }),
  setBreakdownMonth: (month) =>
    set((state) => ({
      breakdownMonth: month,
      activeModal:
        state.activeModal?.type === "monthlyBreakdown"
          ? { ...state.activeModal, month }
          : state.activeModal,
    })),
  setBreakdownMonthRange: (range) =>
    set(() => ({
      breakdownMonthRange: { fromMonth: range.fromMonth ?? null, toMonth: range.toMonth ?? null },
    })),
  setWorkspaceMode: (mode) =>
    set(() => ({
      workspaceMode: mode,
    })),
}));
