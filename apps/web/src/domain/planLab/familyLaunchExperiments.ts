import { addMonths } from "../members/age";
import type { FamilyLaunchDraft } from "./types";
import { normalizeMonthStrict } from "../../utils/month";

export type FamilyLaunchExperiment = {
  id: string;
  labelKey: string;
  defaultLabel: string;
  applies: (draft: FamilyLaunchDraft) => boolean;
  apply: (draft: FamilyLaunchDraft) => FamilyLaunchDraft;
};

const shiftMonth = (value: string | undefined, delta: number) => {
  if (!value) {
    return value;
  }
  const normalized = normalizeMonthStrict(value);
  if (!normalized.ok) {
    return value;
  }
  return addMonths(normalized.month, delta);
};

export const familyLaunchExperiments: FamilyLaunchExperiment[] = [
  {
    id: "purchase-plus-6",
    labelKey: "planLabFamilyExperimentPurchasePlus6",
    defaultLabel: "Purchase month +6",
    applies: (draft) => Boolean(draft.housing?.purchaseMonth),
    apply: (draft) => ({
      ...draft,
      housing: {
        ...draft.housing,
        purchaseMonth: shiftMonth(draft.housing?.purchaseMonth, 6),
      },
    }),
  },
  {
    id: "purchase-minus-6",
    labelKey: "planLabFamilyExperimentPurchaseMinus6",
    defaultLabel: "Purchase month -6",
    applies: (draft) => Boolean(draft.housing?.purchaseMonth),
    apply: (draft) => ({
      ...draft,
      housing: {
        ...draft.housing,
        purchaseMonth: shiftMonth(draft.housing?.purchaseMonth, -6),
      },
    }),
  },
  {
    id: "rate-plus-1",
    labelKey: "planLabFamilyExperimentRatePlus1",
    defaultLabel: "Rate +1%",
    applies: (draft) => draft.housing?.housingMode === "buy-home",
    apply: (draft) => ({
      ...draft,
      housing: {
        ...draft.housing,
        mortgageRatePct: (draft.housing?.mortgageRatePct ?? 0) + 1,
      },
    }),
  },
  {
    id: "down-payment-plus-5",
    labelKey: "planLabFamilyExperimentDownPaymentPlus5",
    defaultLabel: "Down payment +5%",
    applies: (draft) => draft.housing?.housingMode === "buy-home",
    apply: (draft) => ({
      ...draft,
      housing: {
        ...draft.housing,
        downPaymentPct: (draft.housing?.downPaymentPct ?? 0) + 5,
      },
    }),
  },
  {
    id: "baby-budget-plus-2000",
    labelKey: "planLabFamilyExperimentBabyBudgetPlus2000",
    defaultLabel: "Baby budget +2000",
    applies: (draft) => Boolean(draft.baby?.dueMonth),
    apply: (draft) => ({
      ...draft,
      baby: {
        ...draft.baby,
        babyMonthlyBudget: (draft.baby?.babyMonthlyBudget ?? 0) + 2000,
      },
    }),
  },
  {
    id: "wedding-budget-plus-50000",
    labelKey: "planLabFamilyExperimentWeddingBudgetPlus50000",
    defaultLabel: "Wedding budget +50k",
    applies: (draft) => Boolean(draft.wedding?.weddingMonth),
    apply: (draft) => ({
      ...draft,
      wedding: {
        ...draft.wedding,
        weddingBudget: (draft.wedding?.weddingBudget ?? 0) + 50000,
      },
    }),
  },
  {
    id: "swap-wedding-purchase",
    labelKey: "planLabFamilyExperimentSwapWeddingPurchase",
    defaultLabel: "Swap wedding & purchase",
    applies: (draft) =>
      Boolean(draft.wedding?.weddingMonth && draft.housing?.purchaseMonth),
    apply: (draft) => ({
      ...draft,
      wedding: {
        ...draft.wedding,
        weddingMonth: draft.housing?.purchaseMonth,
      },
      housing: {
        ...draft.housing,
        purchaseMonth: draft.wedding?.weddingMonth,
      },
    }),
  },
];
