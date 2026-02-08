import { describe, expect, it } from "vitest";
import { getScenarioSeeds } from "../scenarioSeeds";

const t = Object.assign((key: string) => key, {
  raw: () => [],
});

describe("scenario seed mapping", () => {
  it("summarizes the dual-income home seed totals", () => {
    const seeds = getScenarioSeeds(t);
    const seed = seeds.find((entry) => entry.id === "dual-income-home");

    expect(Boolean(seed)).toBe(true);
    expect(seed?.summary.monthlyIncome).toBe(65000);
    expect(seed?.summary.monthlyExpense).toBe(35500);
    expect(seed?.summary.monthlyNet).toBe(29500);
    expect(seed?.summary.assetsTotal).toBe(6250000);
    expect(seed?.summary.liabilitiesTotal).toBe(4800000);
  });
});
