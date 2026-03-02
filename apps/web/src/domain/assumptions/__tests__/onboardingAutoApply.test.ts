import { describe, expect, it } from "vitest";
import type { Scenario } from "../../../store/scenarioStore";
import {
  buildOnboardingAssumptionsAutoFillPatch,
  shouldAutoApplyOnboardingAssumptions,
} from "../onboardingAutoApply";

const buildScenario = (
  overrides?: Partial<Scenario>
): Scenario => ({
  id: "scenario-1",
  name: "Scenario",
  baseCurrency: "HKD",
  updatedAt: Date.now(),
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Low",
  },
  assumptions: {
    horizonMonths: 360,
    initialCash: 0,
    baseMonth: "2026-01",
  },
  meta: { onboarded: true },
  ...overrides,
});

describe("onboarding assumptions auto apply", () => {
  it("builds a baseline patch for newly onboarded scenarios", () => {
    const scenario = buildScenario();

    const patch = buildOnboardingAssumptionsAutoFillPatch(scenario.assumptions);

    expect(patch).toMatchObject({
      inflationRate: 2,
      salaryGrowthRate: 3,
      rentAnnualGrowthPct: 2,
      propertyAppreciationPct: 2,
      carDepreciationRatePct: 12,
      cashYieldPct: 2,
      investmentReturnAssumptions: {
        equity: 5,
        bond: 5,
        fund: 5,
        crypto: 5,
      },
    });
    expect(
      shouldAutoApplyOnboardingAssumptions({
        scenario,
        hasAppliedFlag: false,
      })
    ).toBe(true);
  });

  it("only fills missing values and does not overwrite explicit assumptions", () => {
    const scenario = buildScenario({
      assumptions: {
        horizonMonths: 360,
        initialCash: 0,
        baseMonth: "2026-01",
        inflationRate: 4,
        salaryGrowthRate: 6,
        rentAnnualGrowthPct: 1.5,
        propertyAppreciationPct: 4,
        cashYieldPct: 1.2,
        investmentReturnAssumptions: {
          equity: 9,
          bond: 2,
          fund: 4,
          crypto: 7,
        },
      },
    });

    const patch = buildOnboardingAssumptionsAutoFillPatch(scenario.assumptions);

    expect(patch).toEqual({
      carDepreciationRatePct: 12,
    });
  });

  it("does not auto apply again on revisit when flag is already set", () => {
    const scenario = buildScenario();

    expect(
      shouldAutoApplyOnboardingAssumptions({
        scenario,
        hasAppliedFlag: true,
      })
    ).toBe(false);
  });
});
