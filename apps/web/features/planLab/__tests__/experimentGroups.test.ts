import { describe, expect, it } from "vitest";
import { filterScenarioV2PatchesByExperimentGroups } from "../experimentGroups";
import type { PlanLabScenarioV2Patches } from "../../../src/domain/planLab/scenarioV2Patches";
import type { ScenarioEvent } from "../../../src/domain/scenarioV2/events";
import type { BudgetRule } from "../../../src/store/scenarioStore";

const baseEvent: ScenarioEvent = {
  id: "event-a",
  type: "cashflow",
  kind: "expense",
  cadence: "monthly",
  amount: 1000,
  startMonth: "2024-01",
};

const baseRule: BudgetRule = {
  id: "rule-a",
  name: "Rule A",
  enabled: true,
  category: "baseline",
  ageBand: { fromYears: 0, toYears: 120 },
  monthlyAmount: 2000,
};

describe("filterScenarioV2PatchesByExperimentGroups", () => {
  it("removes disabled experiment updates/removals from patches", () => {
    const patches: PlanLabScenarioV2Patches = {
      events: {
        add: [baseEvent, { ...baseEvent, id: "event-b" }],
        update: { "event-c": { label: "Updated" } },
        remove: ["event-d"],
      },
      assets: { add: [], update: {}, remove: [] },
      liabilities: { add: [], update: {}, remove: [] },
      members: { add: [], update: {}, remove: [] },
      rules: {
        add: [],
        update: { "rule-a": { name: "Rule A updated" } },
        remove: ["rule-b"],
      },
    };

    const filtered = filterScenarioV2PatchesByExperimentGroups(patches, [
      {
        experimentId: "exp-1",
        title: "Experiment",
        isEnabled: false,
        itemIds: [
          "events:event-a",
          "events:event-c",
          "events:event-d",
          "rules:rule-a",
          "rules:rule-b",
        ],
        createdAt: Date.now(),
      },
    ]);

    expect(filtered.events.add.map((item) => item.id)).toEqual(["event-b"]);
    expect(Object.keys(filtered.events.update)).toEqual([]);
    expect(filtered.events.remove).toEqual([]);
    expect(Object.keys(filtered.rules.update)).toEqual([]);
    expect(filtered.rules.remove).toEqual([]);
  });
});
