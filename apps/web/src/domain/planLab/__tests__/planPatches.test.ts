import { describe, expect, it } from "vitest";
import { buildPlanPatchesFromSnapshot } from "../planPatches";
import type { PlanLabSnapshot } from "../types";

describe("buildPlanPatchesFromSnapshot", () => {
  it("includes only enabled experiments", () => {
    const snapshot: PlanLabSnapshot = {
      baselinePatches: {},
      experiments: [
        {
          id: "exp-enabled",
          type: "oneOffExpense",
          month: "2024-01",
          amount: 1000,
          isEnabled: true,
        },
        {
          id: "exp-disabled",
          type: "oneOffExpense",
          month: "2024-02",
          amount: 500,
          isEnabled: false,
        },
      ],
    };

    const patches = buildPlanPatchesFromSnapshot(snapshot);
    const experimentPatches = patches.filter((patch) => patch.path === "experiment");

    expect(experimentPatches).toHaveLength(1);
    expect(experimentPatches[0]?.id).toBe("exp-enabled");
  });
});
