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
      enableDeferredTemplates: false,
      hasEligibleIncomeEvent: true,
      hasEditableMortgageEvent: false,
      hasEditableHousingEvent: false,
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

    expect(homePurchaseTemplate?.description).toContain("purchase price");
    expect(homePurchaseTemplate?.costRangeItems.map((item) => item.id)).toContain(
      "homePurchasePrice"
    );
  });

  it("disables income shock template when no editable income event exists", () => {
    const templates = buildPlanLabDecisionTemplateOptions({
      enableDeferredTemplates: false,
      hasEligibleIncomeEvent: false,
      hasEditableMortgageEvent: false,
      hasEditableHousingEvent: false,
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
    const aggressiveInput = buildBundleWizardInputForDecisionTemplate({
      templateId: "rental_plan",
      selectedCostProfile: "aggressive",
      baseMonth: "2026-03",
    });

    const conservativeInput = buildBundleWizardInputForDecisionTemplate({
      templateId: "rental_plan",
      selectedCostProfile: "conservative",
      baseMonth: "2026-03",
    });

    const medianInput = buildBundleWizardInputForDecisionTemplate({
      templateId: "rental_plan",
      selectedCostProfile: "median",
      baseMonth: "2026-03",
    });

    expect(aggressiveInput).toEqual({
      templateId: "life_rental_plan",
      input: {
        startMonth: "2026-03",
        rentMonthly: 50000,
        rentAnnualGrowthPct: 4,
        depositAmount: 100000,
        agentFeeAmount: 25000,
      },
    });

    expect(conservativeInput).toEqual({
      templateId: "life_rental_plan",
      input: {
        startMonth: "2026-03",
        rentMonthly: 16000,
        rentAnnualGrowthPct: 2.5,
        depositAmount: 32000,
        agentFeeAmount: 8000,
      },
    });

    expect(medianInput).toEqual({
      templateId: "life_rental_plan",
      input: {
        startMonth: "2026-03",
        rentMonthly: 28000,
        rentAnnualGrowthPct: 3,
        depositAmount: 56000,
        agentFeeAmount: 14000,
      },
    });
  });

  it("keeps deferred templates hidden while the beta gate is disabled", () => {
    const templates = buildPlanLabDecisionTemplateOptions({
      enableDeferredTemplates: false,
      hasEligibleIncomeEvent: true,
      hasEditableMortgageEvent: true,
      hasEditableHousingEvent: true,
      translate,
      selectedCostProfile: {},
    });

    expect(templates.map((template) => template.id)).not.toContain("mortgage_rate_hike");
    expect(templates.map((template) => template.id)).not.toContain("move_home");
  });

  it("adds deferred templates after the beta launch gate is enabled and keeps them fail-closed when baseline events are missing", () => {
    const templates = buildPlanLabDecisionTemplateOptions({
      enableDeferredTemplates: true,
      hasEligibleIncomeEvent: true,
      hasEditableMortgageEvent: false,
      hasEditableHousingEvent: false,
      translate,
      selectedCostProfile: {
        mortgage_rate_hike: "aggressive",
        move_home: "conservative",
      },
    });

    const mortgageRateHike = templates.find(
      (template) => template.id === "mortgage_rate_hike"
    );
    const moveHome = templates.find((template) => template.id === "move_home");

    expect(mortgageRateHike?.launcher).toBe("event_edit_mortgage");
    expect(mortgageRateHike?.selectedCostProfile).toBe("aggressive");
    expect(mortgageRateHike?.availability.enabled).toBe(false);
    expect(mortgageRateHike?.availability.reasonFallback).toContain("baseline mortgage");
    expect(mortgageRateHike?.costRangeItems.map((item) => item.id)).toEqual([
      "mortgageRateHikeRateUplift",
      "mortgageRateHikePaymentPressure",
    ]);

    expect(moveHome?.launcher).toBe("event_edit_housing");
    expect(moveHome?.selectedCostProfile).toBe("conservative");
    expect(moveHome?.availability.enabled).toBe(false);
    expect(moveHome?.availability.reasonFallback).toContain("baseline housing");
    expect(moveHome?.costRangeItems.map((item) => item.id)).toEqual([
      "moveHomeTimingShift",
      "moveHomeTransitionFocus",
    ]);
  });

  it("enables deferred templates when the gate is on and active-scenario baseline events are available", () => {
    const templates = buildPlanLabDecisionTemplateOptions({
      enableDeferredTemplates: true,
      hasEligibleIncomeEvent: true,
      hasEditableMortgageEvent: true,
      hasEditableHousingEvent: true,
      translate,
      selectedCostProfile: {},
    });

    expect(
      templates.find((template) => template.id === "mortgage_rate_hike")?.availability.enabled
    ).toBe(true);
    expect(
      templates.find((template) => template.id === "move_home")?.availability.enabled
    ).toBe(true);
  });
});
