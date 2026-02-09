import { describe, expect, it } from "vitest";
import { getScenarioSeeds } from "../scenarioSeeds";

const t = Object.assign((key: string) => key, {
  raw: () => [],
});

describe("scenario seed mapping", () => {
  it("exposes the configured scenario seeds", () => {
    const seeds = getScenarioSeeds(t);
    const seedKeys = seeds.map((seed) => seed.seedKey);

    expect(seedKeys).toEqual([
      "single_renter_saver",
      "couple_home_purchase",
      "couple_home_with_rent",
      "newbaby_basic",
      "newbaby_with_helper",
      "high_networth_mix",
    ]);
    expect(seeds[0]?.environmentPreset.baseMonth).toBe("2026-02");
  });
});
