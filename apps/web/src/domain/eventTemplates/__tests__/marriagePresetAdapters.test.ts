import { describe, expect, it } from "vitest";
import {
  applyHoneymoonPresetToForm,
  applyTravelPresetToForm,
  applyWeddingPresetToForm,
  type MarriagePresetDraft,
} from "../marriagePresetAdapters";

const baseDraft: MarriagePresetDraft = {
  weddingStyle: "simple_register",
  totalWeddingBudget: 30000,
  breakdownEnabled: true,
  customBreakdown: false,
  breakdownItems: [
    { id: "a", label: "A", amount: 0, ratio: 50 },
    { id: "b", label: "B", amount: 0, ratio: 50 },
  ],
  includeTravel: false,
  travelMonthMode: "same",
  travelBudgetMode: "total",
  travelTotal: 0,
  travellersCount: 2,
  perPersonBudget: 0,
  isCustomized: false,
};

describe("marriage preset adapters", () => {
  it("applyWeddingPresetToForm updates totalWeddingBudget and breakdown", () => {
    const result = applyWeddingPresetToForm(baseDraft, "hotel_banquet");
    expect(result.needsConfirm).toBe(false);
    expect(result.draft.totalWeddingBudget).toBe(300000);
    expect(result.draft.breakdownItems[0]?.amount).toBe(150000);
  });

  it("applyTravelPresetToForm updates travel fields", () => {
    const result = applyTravelPresetToForm(baseDraft, "japan");
    expect(result.needsConfirm).toBe(false);
    expect(result.draft.travelBudgetMode).toBe("perPerson");
    expect(result.draft.travellersCount).toBe(2);
    expect(result.draft.perPersonBudget).toBe(25000);
    expect(result.draft.travelMonthMode).toBe("same");
  });

  it("returns needsConfirm when draft is already customized", () => {
    const customizedDraft = { ...baseDraft, isCustomized: true };
    const result = applyHoneymoonPresetToForm(customizedDraft, "japan");
    expect(result.needsConfirm).toBe(true);
    expect(result.draft).toEqual(customizedDraft);
  });
});
