import { describe, expect, it } from "vitest";
import { buildOnboardingDraftStateFromSeed } from "../../features/onboarding/seedPrefill";
import { getScenarioSeeds } from "../scenarioSeeds";

const t = Object.assign((key: string) => key, {
  raw: () => [],
});

describe("quick start preset smoke", () => {
  it("builds all presets with members, assumptions, and non-zero cashflow totals", () => {
    const seeds = getScenarioSeeds(t);

    expect(seeds).toHaveLength(6);

    seeds.forEach((seed) => {
      expect(seed.payload.members.length > 0).toBe(true);
      expect(seed.payload.events.length > 0).toBe(true);
      expect(typeof seed.payload.assumptions?.inflationRate === "number").toBe(true);
      expect(typeof seed.payload.assumptions?.salaryGrowthRate === "number").toBe(true);
      expect(seed.summary.monthlyIncome > 0).toBe(true);
      expect(seed.summary.monthlyExpense > 0).toBe(true);
    });
  });

  it("keeps 13th month bonus in dual-income-home", () => {
    const seed = getScenarioSeeds(t).find((entry) => entry.id === "dual-income-home");

    expect(Boolean(seed)).toBe(true);
    const yearlyBonus = seed?.payload.events.find(
      (event) =>
        event.type === "cashflow" &&
        event.kind === "income" &&
        event.cadence === "yearly" &&
        event.label === "seeds.eventLabels.bonus"
    );

    expect(Boolean(yearlyBonus)).toBe(true);
  });

  it("hydrates the single-renter preset into rent housing without counting rent twice", () => {
    const seed = getScenarioSeeds(t).find((entry) => entry.id === "single-renter");

    expect(Boolean(seed)).toBe(true);

    const draft = buildOnboardingDraftStateFromSeed(seed!.payload);

    expect(draft.housing.mode).toBe("rent");
    expect(draft.housing.rent.amount).toBe(12000);
    expect(draft.livingSpend.fixed.amount).toBe(6000);
  });
});
