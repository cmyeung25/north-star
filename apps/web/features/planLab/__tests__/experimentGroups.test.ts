import { describe, expect, it } from "vitest";
import type { ScenarioV2 } from "../../../src/engine/scenarioV2Compiler";
import {
  applyPlanLabScenarioV2Patches,
  emptyPlanLabScenarioV2Patches,
} from "../../../src/domain/planLab/scenarioV2Patches";
import {
  filterScenarioV2PatchesByExperimentGroups,
  removeExperimentGroupItemsFromPatches,
  type PlanLabExperimentGroup,
} from "../experimentGroups";

const buildScenario = (overrides: Partial<ScenarioV2> = {}): ScenarioV2 => ({
  id: "scenario-1",
  name: "Scenario",
  baseCurrency: "HKD",
  updatedAt: 0,
  assumptions: {
    horizonMonths: 12,
    initialCash: 0,
    baseMonth: "2026-01",
  },
  events: [],
  assets: [],
  liabilities: [],
  members: [],
  ...overrides,
});

describe("filterScenarioV2PatchesByExperimentGroups", () => {
  it("keeps baseline events when a bundle experiment is toggled off", () => {
    const baselineEvent = {
      id: "event-base",
      type: "cashflow" as const,
      kind: "expense" as const,
      cadence: "monthly" as const,
      amount: 20000,
      startMonth: "2026-01",
      label: "Mortgage payment",
    };
    const baseline = buildScenario({ events: [baselineEvent] });
    const patches = emptyPlanLabScenarioV2Patches();
    patches.events.add.push({
      id: "event-experiment",
      type: "cashflow",
      kind: "expense",
      cadence: "monthly",
      amount: 25147,
      startMonth: "2026-01",
      label: "Mortgage payment (experiment)",
    });
    patches.events.remove.push(baselineEvent.id);

    const group: PlanLabExperimentGroup = {
      experimentId: "exp-1",
      title: "Mortgage experiment",
      isEnabled: false,
      itemIds: ["events:event-experiment", `events:${baselineEvent.id}`],
      bundleInstanceId: "bundle-1",
      createdAt: 0,
    };

    const filtered = filterScenarioV2PatchesByExperimentGroups(patches, [group]);
    const sandbox = applyPlanLabScenarioV2Patches(baseline, filtered);

    const eventIds = (sandbox.events ?? []).map((event) => event.id);
    expect(eventIds).toContain(baselineEvent.id);
    expect(eventIds).not.toContain("event-experiment");
  });
});


describe("removeExperimentGroupItemsFromPatches", () => {
  it("deletes experiment overlay without deleting baseline event", () => {
    const baselineEvent = {
      id: "event-base",
      type: "cashflow" as const,
      kind: "income" as const,
      cadence: "monthly" as const,
      amount: 30000,
      startMonth: "2026-01",
      label: "固定薪金",
    };
    const baseline = buildScenario({ events: [baselineEvent] });
    const patches = emptyPlanLabScenarioV2Patches();
    patches.events.update[baselineEvent.id] = { amount: 32000 };

    const group: PlanLabExperimentGroup = {
      experimentId: "exp-salary",
      title: "薪金實驗",
      isEnabled: true,
      itemIds: [`events:${baselineEvent.id}`],
      createdAt: 0,
    };

    const next = removeExperimentGroupItemsFromPatches(patches, group);
    const preview = applyPlanLabScenarioV2Patches(baseline, next);

    expect(next.events.remove).not.toContain(baselineEvent.id);
    expect((preview.events ?? []).some((event) => event.id === baselineEvent.id)).toBe(true);
    expect(preview.events ?? []).toHaveLength(1);
  });

  it("unapplies one experiment while keeping other overlays on same baseline event", () => {
    const baselineEvent = {
      id: "event-base",
      type: "cashflow" as const,
      kind: "expense" as const,
      cadence: "monthly" as const,
      amount: 18000,
      startMonth: "2026-01",
      label: "固定薪金",
    };
    const baseline = buildScenario({ events: [baselineEvent] });
    const patches = emptyPlanLabScenarioV2Patches();
    patches.events.update[baselineEvent.id] = { amount: 20000 };

    const disabledGroup: PlanLabExperimentGroup = {
      experimentId: "exp-a",
      title: "A",
      isEnabled: false,
      itemIds: [`events:${baselineEvent.id}`],
      createdAt: 0,
    };
    const activeGroup: PlanLabExperimentGroup = {
      experimentId: "exp-b",
      title: "B",
      isEnabled: true,
      itemIds: [`events:${baselineEvent.id}`],
      createdAt: 0,
    };

    const preview = applyPlanLabScenarioV2Patches(
      baseline,
      filterScenarioV2PatchesByExperimentGroups(patches, [disabledGroup, activeGroup])
    );

    expect((preview.events ?? []).some((event) => event.id === baselineEvent.id)).toBe(true);
    expect(preview.events ?? []).toHaveLength(1);
  });
});
