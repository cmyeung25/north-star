import type { Scenario } from "@north-star/types";

export function createEmptyScenario(): Scenario {
  return {
    schemaVersion: "1.0.0",
    engineVersion: "0.1.0",
    name: "Untitled scenario",
    createdAt: new Date().toISOString(),
    assumptions: {
      inflationRate: 0.02,
      wageGrowthRate: 0.03,
      realReturnRate: 0.04,
    },
    events: [],
  };
}
