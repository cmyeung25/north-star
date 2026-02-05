import { describe, expect, it } from "vitest";
import { computeProjection } from "@north-star/engine";
import { compileScenarioV2ToProjectionInput, type ScenarioV2 } from "../../../src/engine/scenarioV2Compiler";
import { emptyPlanLabScenarioV2Patches } from "../../../src/domain/planLab/scenarioV2Patches";
import {
  filterScenarioV2PatchesByExperimentGroups,
  removeExperimentGroupItemsFromPatches,
  type PlanLabExperimentGroup,
} from "../experimentGroups";

const buildScenario = (overrides: Partial<ScenarioV2> = {}): ScenarioV2 => ({
  id: "scenario-1",
  name: "Scenario",
  baseCurrency: "USD",
  updatedAt: 0,
  assumptions: {
    horizonMonths: 12,
    initialCash: 0,
    baseMonth: "2024-01",
  },
  events: [],
  ...overrides,
});

describe("PlanLab experiment group toggles items inclusion safely", () => {
  it("filters disabled grouped items from projection input", () => {
    const patches = emptyPlanLabScenarioV2Patches();
    patches.events.add.push({
      id: "event-income",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 5000,
      startMonth: "2024-01",
      label: "Income",
    });

    const enabled = filterScenarioV2PatchesByExperimentGroups(patches, [
      {
        experimentId: "exp1",
        title: "Baby plan",
        isEnabled: true,
        itemIds: ["events:event-income"],
        createdAt: Date.now(),
      },
    ]);
    const enabledProjection = computeProjection(
      compileScenarioV2ToProjectionInput({ ...buildScenario(), events: enabled.events.add })
    );

    const disabled = filterScenarioV2PatchesByExperimentGroups(patches, [
      {
        experimentId: "exp1",
        title: "Baby plan",
        isEnabled: false,
        itemIds: ["events:event-income"],
        createdAt: Date.now(),
      },
    ]);
    const disabledProjection = computeProjection(
      compileScenarioV2ToProjectionInput({ ...buildScenario(), events: disabled.events.add })
    );

    expect(enabled.events.add).toHaveLength(1);
    expect(disabled.events.add).toHaveLength(0);
    expect(new Set(enabledProjection.cashBalance).size > 1).toBe(true);
    expect(new Set(disabledProjection.cashBalance).size).toBe(1);
  });

  it("removes grouped items in batch from patches", () => {
    const patches = emptyPlanLabScenarioV2Patches();
    patches.events.add.push({
      id: "event-income",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 5000,
      startMonth: "2024-01",
      label: "Income",
    });
    patches.rules.update["rule-1"] = { name: "Updated" };

    const group: PlanLabExperimentGroup = {
      experimentId: "exp1",
      title: "Bundle",
      isEnabled: true,
      itemIds: ["events:event-income", "rules:rule-1"],
      createdAt: Date.now(),
    };

    const next = removeExperimentGroupItemsFromPatches(patches, group);
    expect(next.events.add).toHaveLength(0);
    expect(next.rules.update["rule-1"]).toBeUndefined();
    expect(next.rules.remove).toContain("rule-1");
  });
});
