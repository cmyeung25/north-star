import { describe, expect, it } from "vitest";
import {
  INCOME_SHOCK_DEFAULT_PAYLOAD,
  buildBundleWizardInputForDecisionTemplate,
  buildIncomeShockDefaultPayload,
  buildPlanLabDecisionTemplateOptions,
} from "../decisionTemplates";

const translate = (_key: string, fallback: string) => fallback;

describe("decisionTemplates", () => {
  it("returns decision templates with local cost ranges", () => {
    const templates = buildPlanLabDecisionTemplateOptions({
      hasEligibleIncomeEvent: true,
      translate,
      selectedCostProfile: {},
    });

    expect(templates).toHaveLength(7);
    expect(templates.map((template) => template.id)).toEqual([
      "marriage",
      "childbirth",
      "parenting",
      "home_purchase",
      "rental_plan",
      "retirement",
      "income_shock",
    ]);
    const homePurchaseTemplate = templates.find((template) => template.id === "home_purchase");
    const rentalTemplate = templates.find((template) => template.id === "rental_plan");
    expect((homePurchaseTemplate?.costRangeItems.length ?? 0) > 0).toBe(true);
    expect((rentalTemplate?.costRangeItems.length ?? 0) > 0).toBe(true);
  });

  it("disables income shock template when no editable income event exists", () => {
    const templates = buildPlanLabDecisionTemplateOptions({
      hasEligibleIncomeEvent: false,
      translate,
      selectedCostProfile: {},
    });

    const incomeShock = templates.find((template) => template.id === "income_shock");
    expect(incomeShock?.availability.enabled).toBe(false);
    expect(incomeShock?.availability.reasonFallback).toContain("No editable baseline income");
  });

  it("builds default income shock payload using base month", () => {
    const payload = buildIncomeShockDefaultPayload({
      baseMonth: "2026-03",
    });

    expect(payload).toEqual({
      ...INCOME_SHOCK_DEFAULT_PAYLOAD,
      startMonth: "2026-04",
      endMonth: "2027-03",
    });
  });

  it("falls back to event start month when base month is unavailable", () => {
    const payload = buildIncomeShockDefaultPayload({
      baseMonth: null,
      fallbackStartMonth: "2026-05",
    });

    expect(payload?.startMonth).toBe("2026-06");
    expect(payload?.endMonth).toBe("2027-05");
  });

  it("builds marriage wizard input defaults from selected cost profile", () => {
    const input = buildBundleWizardInputForDecisionTemplate({
      templateId: "marriage",
      selectedCostProfile: "median",
      baseMonth: "2026-03",
    });

    expect(input).toEqual({
      templateId: "life_marriage_plan",
      input: {
        weddingMonth: "2026-03",
        weddingStyle: "hotel_banquet",
        totalWeddingBudget: 300000,
        breakdownEnabled: false,
        breakdownItems: [],
        includeTravel: false,
      },
    });
  });

  it("builds rental plan bundle defaults from selected cost profile", () => {
    const input = buildBundleWizardInputForDecisionTemplate({
      templateId: "rental_plan",
      selectedCostProfile: "aggressive",
      baseMonth: "2026-03",
    });

    expect(input).toEqual({
      templateId: "life_rental_plan",
      input: {
        startMonth: "2026-03",
        rentMonthly: 50000,
        rentAnnualGrowthPct: 4,
        depositAmount: 100000,
        agentFeeAmount: 25000,
      },
    });
  });
});
