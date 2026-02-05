import { describe, expect, it } from "vitest";
import {
  collectUngroupedPatchItemIds,
  filterScenarioV2PatchesByExperimentGroups,
  createSingleItemExperimentGroup,
  resolveExperimentGroupTitle,
  resolveSingleItemExperimentTitle,
} from "../experimentGroups";
import type { PlanLabScenarioV2Patches } from "../../../src/domain/planLab/scenarioV2Patches";

describe("resolveExperimentGroupTitle", () => {
  it("uses localized fallback for known template ids", () => {
    expect(resolveExperimentGroupTitle("life_home_purchase")).toBe("置業買樓");
    expect(resolveExperimentGroupTitle("life_new_baby")).toBe("新生兒計劃");
  });

  it("falls back to 未命名實驗 when empty", () => {
    expect(resolveExperimentGroupTitle("   ")).toBe("未命名實驗");
    expect(resolveExperimentGroupTitle(undefined)).toBe("未命名實驗");
  });

  it("humanizes internal ids instead of rendering raw ids", () => {
    expect(resolveExperimentGroupTitle("unknown_internal_id")).toBe("Unknown Internal Id");
  });
});


describe("single item experiment helpers", () => {
  it("builds fallback single-item title when label is empty", () => {
    expect(resolveSingleItemExperimentTitle(" ")).toBe("實驗：單一項目");
  });

  it("creates an enabled experiment group containing the target item", () => {
    const group = createSingleItemExperimentGroup({
      experimentId: "exp_group_1",
      itemId: "events:evt_1",
      itemLabel: "Living expenses",
      createdAt: 123,
    });

    expect(group).toEqual({
      experimentId: "exp_group_1",
      title: "實驗：Living expenses",
      isEnabled: true,
      itemIds: ["events:evt_1"],
      createdAt: 123,
    });
  });
});

describe("removed experiment items", () => {
  const patches: PlanLabScenarioV2Patches = {
    events: { add: [{ id: "evt_1", type: "adjustment", kind: "cash", amount: 1000, month: "2025-01" }], update: {}, remove: [] },
    assets: { add: [{ id: "asset_1", kind: "other", label: "Asset", currentValue: 100000 }], update: {}, remove: [] },
    liabilities: { add: [], update: {}, remove: [] },
    members: { add: [], update: {}, remove: [] },
    rules: { add: [], update: {}, remove: [] },
  };

  it("excludes removed item ids from projection filtering", () => {
    const filtered = filterScenarioV2PatchesByExperimentGroups(patches, [
      {
        experimentId: "exp_1",
        title: "Test",
        isEnabled: true,
        itemIds: ["events:evt_1", "assets:asset_1"],
        removedItems: [{ itemId: "events:evt_1", removedAt: 123, meta: { type: "income" } }],
        createdAt: 1,
      },
    ]);

    expect(filtered.events.add).toHaveLength(0);
    expect(filtered.assets.add).toHaveLength(1);
  });

  it("treats removed item ids as ungrouped candidates", () => {
    const ungrouped = collectUngroupedPatchItemIds(patches, [
      {
        experimentId: "exp_1",
        title: "Test",
        isEnabled: true,
        itemIds: ["events:evt_1", "assets:asset_1"],
        removedItems: [{ itemId: "events:evt_1", removedAt: 123, meta: { type: "income" } }],
        createdAt: 1,
      },
    ]);

    expect(ungrouped).toContain("events:evt_1");
    expect(ungrouped).not.toContain("assets:asset_1");
  });
});
