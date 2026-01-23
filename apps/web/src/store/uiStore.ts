import { create } from "zustand";

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
  activeDrawer: ActiveDrawer | null;
  activeModal: ActiveModal | null;
  breakdownOpen: boolean;
  breakdownMonth: string | null;
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
};

export const useUiStore = create<UiState>((set) => ({
  activeDrawer: null,
  activeModal: null,
  breakdownOpen: false,
  breakdownMonth: null,
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
}));
