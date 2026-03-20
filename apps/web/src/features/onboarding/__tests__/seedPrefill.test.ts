import { describe, expect, it } from "vitest";
import { buildOnboardingDraftStateFromSeed } from "../seedPrefill";
import type { ScenarioSeedPayload } from "../../../scenarios/scenarioSeeds";

describe("buildOnboardingDraftStateFromSeed", () => {
  it("keeps owned property without mortgage on the no-mortgage path", () => {
    const payload: ScenarioSeedPayload = {
      baseMonth: "2026-01",
      baseCurrency: "HKD",
      initialCash: 100000,
      assumptions: {
        horizonMonths: 120,
        inflationRate: 2,
        mortgageRatePct: 3.5,
      },
      members: [{ id: "self", name: "Me", kind: "person" }],
      assets: [],
      liabilities: [],
      events: [
        {
          id: "seed-home-no-mortgage",
          type: "housing",
          kind: "mortgage",
          startMonth: "2026-01",
          propertyMarketValue: 5_000_000,
          mortgageBaseValue: 5_000_000,
          downPaymentMode: "amount",
          downPaymentAmount: 5_000_000,
          mortgageRatePct: 0,
          mortgageTermYears: 0,
          mortgagePayment: 0,
        },
      ],
      bundleInstances: [],
      bundleSummaries: [],
    };

    const draft = buildOnboardingDraftStateFromSeed(payload);

    expect(draft.housing.mode).toBe("own");
    expect(draft.housing.own.mortgageEnabled).toBe(false);
    expect(draft.housing.own.propertyMarketValue).toBe(5_000_000);
  });
});
