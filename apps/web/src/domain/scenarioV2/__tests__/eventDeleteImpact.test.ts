import { describe, expect, it } from "vitest";
import type { ScenarioV2 } from "../../../engine/scenarioV2Compiler";
import { buildEventDeleteImpact } from "../eventDeleteImpact";

describe("buildEventDeleteImpact", () => {
  it("filters ledger rows by sourceEventId", () => {
    const scenario: ScenarioV2 = {
      id: "scenario-v2",
      name: "Scenario",
      baseCurrency: "HKD",
      updatedAt: 0,
      assumptions: {
        horizonMonths: 120,
        initialCash: 0,
        baseMonth: "2024-01",
        inflationRate: 2,
      },
      events: [
        {
          id: "evt-housing",
          type: "housing",
          kind: "mortgage",
          startMonth: "2024-01",
          purchasePrice: 1000000,
          downPaymentMode: "percent",
          downPaymentPercent: 20,
          mortgageRatePct: 4,
          mortgageTermYears: 30,
          mortgagePayment: 0,
          propertyAssetId: "asset-home-1",
          mortgageLiabilityId: "liability-mortgage-1",
          label: "Home",
        },
      ],
      assets: [
        {
          id: "asset-home-1",
          kind: "home",
          currentValue: 1000000,
          createdByEventId: "evt-housing",
          createdByTemplate: "housing_mortgage",
        },
      ],
      liabilities: [
        {
          id: "liability-mortgage-1",
          kind: "mortgage",
          principalOutstanding: 800000,
          annualInterestRatePct: 4,
          termYears: 30,
          createdByEventId: "evt-housing",
          createdByTemplate: "housing_mortgage",
        },
      ],
      meta: { schemaVersion: 2 },
    };

    const impact = buildEventDeleteImpact(scenario, "evt-housing");
    expect(impact).not.toBeNull();
    expect(
      impact?.ledger.rows.every((row) => row.sourceEventId === "evt-housing")
    ).toBe(true);
  });
});
