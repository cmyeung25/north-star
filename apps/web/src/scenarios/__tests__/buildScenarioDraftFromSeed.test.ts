import { describe, expect, it } from "vitest";
import { buildScenarioDraftFromSeed } from "../buildScenarioDraftFromSeed";
import type { ScenarioSeedPayload } from "../scenarioSeeds";

describe("buildScenarioDraftFromSeed", () => {
  it("builds seed draft with onboarding skip markers while leaving schema/meta compilation to compiler", () => {
    const seedPayload: ScenarioSeedPayload = {
      baseMonth: "2025-01",
      initialCash: 120000,
      assumptions: {
        horizonMonths: 120,
      },
      members: [{ id: "primary", name: "Pat", kind: "person" }],
      assets: [],
      liabilities: [],
      events: [],
      bundleInstances: [],
      bundleSummaries: [],
    };

    const draft = buildScenarioDraftFromSeed(seedPayload);

    expect(draft.assumptions?.baseMonth).toBe("2025-01");
    expect(draft.assumptions?.initialCash).toBe(120000);
    expect(draft.meta).toEqual({
      isSeeded: true,
      skipOnboarding: true,
      onboardingVersion: 2,
    });
    expect(draft.meta?.schemaVersion).toBeUndefined();
    expect(draft.clientComputed).toEqual({ onboardingCompleted: true });
  });
});
