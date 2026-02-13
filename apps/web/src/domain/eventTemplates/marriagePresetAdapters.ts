import { normalizeWeddingBreakdown, type TravelBudgetMode, type TravelMonthMode, type WeddingStyle } from "./bundles";
import { DESTINATION_WEDDING_PRESETS, HONEYMOON_PRESETS, WEDDING_STYLE_PRESETS } from "./marriageBudgetPresets";

export type MarriagePresetDraft = {
  weddingStyle: WeddingStyle;
  totalWeddingBudget: number;
  breakdownEnabled: boolean;
  customBreakdown: boolean;
  breakdownItems: { id: string; label: string; amount: number; ratio: number }[];
  includeTravel: boolean;
  travelMonthMode: TravelMonthMode;
  travelBudgetMode: TravelBudgetMode;
  travelTotal: number;
  travellersCount: number;
  perPersonBudget: number;
  isCustomized: boolean;
};

type ApplyResult = {
  draft: MarriagePresetDraft;
  needsConfirm: boolean;
};

const applyTravelDefaults = (
  draft: MarriagePresetDraft,
  travel: {
    mode: "perPerson" | "total";
    travellersCount?: number;
    perPersonBudget?: number;
    total?: number;
    monthMode?: TravelMonthMode;
  }
): MarriagePresetDraft => ({
  ...draft,
  includeTravel: true,
  travelBudgetMode: travel.mode,
  travelMonthMode: travel.monthMode ?? draft.travelMonthMode,
  travellersCount: travel.travellersCount ?? draft.travellersCount,
  perPersonBudget: travel.perPersonBudget ?? draft.perPersonBudget,
  travelTotal: travel.total ?? draft.travelTotal,
});

export const applyWeddingPresetToForm = (
  draft: MarriagePresetDraft,
  presetId: string,
  force = false
): ApplyResult => {
  if (draft.isCustomized && !force) {
    return { draft, needsConfirm: true };
  }
  const preset = WEDDING_STYLE_PRESETS.find((item) => item.id === presetId);
  if (!preset) {
    return { draft, needsConfirm: false };
  }
  const totalWeddingBudget = preset.defaults.totalWeddingBudget ?? draft.totalWeddingBudget;
  return {
    needsConfirm: false,
    draft: {
      ...draft,
      weddingStyle: preset.defaults.weddingStyle ?? draft.weddingStyle,
      totalWeddingBudget,
      breakdownItems:
        draft.breakdownEnabled && !draft.customBreakdown
          ? normalizeWeddingBreakdown(totalWeddingBudget, draft.breakdownItems)
          : draft.breakdownItems,
      isCustomized: false,
    },
  };
};

export const applyTravelPresetToForm = (
  draft: MarriagePresetDraft,
  presetId: string,
  force = false
): ApplyResult => {
  if (draft.isCustomized && !force) {
    return { draft, needsConfirm: true };
  }
  const preset = DESTINATION_WEDDING_PRESETS.find((item) => item.id === presetId);
  if (!preset?.defaults.travel) {
    return { draft, needsConfirm: false };
  }
  let next = {
    ...draft,
    weddingStyle: "destination_wedding" as const,
    totalWeddingBudget: preset.defaults.totalWeddingBudget ?? draft.totalWeddingBudget,
    isCustomized: false,
  };
  if (next.breakdownEnabled && !next.customBreakdown) {
    next = {
      ...next,
      breakdownItems: normalizeWeddingBreakdown(next.totalWeddingBudget, next.breakdownItems),
    };
  }
  return {
    needsConfirm: false,
    draft: applyTravelDefaults(next, preset.defaults.travel),
  };
};

export const applyHoneymoonPresetToForm = (
  draft: MarriagePresetDraft,
  presetId: string,
  force = false
): ApplyResult => {
  if (draft.isCustomized && !force) {
    return { draft, needsConfirm: true };
  }
  const preset = HONEYMOON_PRESETS.find((item) => item.id === presetId);
  if (!preset?.defaults.travel) {
    return { draft, needsConfirm: false };
  }
  return {
    needsConfirm: false,
    draft: {
      ...applyTravelDefaults(draft, preset.defaults.travel),
      isCustomized: false,
    },
  };
};
