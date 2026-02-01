import { describe, expect, it } from "vitest";
import type { ScenarioV2 } from "../../../engine/scenarioV2Compiler";
import type { PlanLabSnapshotPayload } from "../types";
import { applyPatchToScenario, computeBaselineFingerprint } from "../snapshotPayload";
import { diffSummaryFromPatches } from "../diffSummary";

const buildScenario = (overrides: Partial<ScenarioV2> = {}): ScenarioV2 => ({
  id: "scenario-1",
  name: "Scenario",
  baseCurrency: "USD",
  updatedAt: 0,
  assumptions: {
    horizonMonths: 120,
    initialCash: 0,
    baseMonth: "2024-01",
  },
  events: [],
  ...overrides,
});

const basePayload: PlanLabSnapshotPayload = {
  eventsPatch: { add: [], update: [], remove: [] },
  rulesPatch: { add: [], update: [], remove: [] },
};

describe("applyPatchToScenario", () => {
  it("adds, updates, and removes events", () => {
    const baseline = buildScenario({
      events: [
        {
          id: "event-1",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 5000,
          startMonth: "2024-01",
          label: "Salary",
        },
        {
          id: "event-2",
          type: "cashflow",
          kind: "expense",
          cadence: "monthly",
          amount: 1000,
          startMonth: "2024-01",
          label: "Rent",
        },
      ],
    });

    const payload: PlanLabSnapshotPayload = {
      ...basePayload,
      eventsPatch: {
        add: [
          {
            id: "event-3",
            type: "cashflow",
            kind: "expense",
            cadence: "oneOff",
            amount: 1200,
            occurrenceMonth: "2024-06",
            label: "Trip",
          },
        ],
        update: [
          {
            id: "event-1",
            patch: { amount: 5500, label: "Salary (updated)" },
          },
        ],
        remove: ["event-2"],
      },
    };

    const result = applyPatchToScenario(baseline, payload);
    expect(result.events).toHaveLength(2);
    const updated = result.events?.find((event) => event.id === "event-1");
    const removed = result.events?.find((event) => event.id === "event-2");
    const added = result.events?.find((event) => event.id === "event-3");
    expect(updated?.label).toBe("Salary (updated)");
    if (updated?.type === "cashflow") {
      expect(updated.amount).toBe(5500);
    }
    expect(removed).toBeUndefined();
    expect(added?.label).toBe("Trip");
  });
});

describe("computeBaselineFingerprint", () => {
  it("remains stable regardless of ordering", () => {
    const scenarioA = buildScenario({
      events: [
        {
          id: "event-1",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 3000,
          startMonth: "2024-01",
        },
        {
          id: "event-2",
          type: "cashflow",
          kind: "expense",
          cadence: "monthly",
          amount: 1500,
          startMonth: "2024-01",
        },
      ],
    });
    const scenarioB = buildScenario({
      events: [
        {
          id: "event-2",
          type: "cashflow",
          kind: "expense",
          cadence: "monthly",
          amount: 1500,
          startMonth: "2024-01",
        },
        {
          id: "event-1",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 3000,
          startMonth: "2024-01",
        },
      ],
    });

    expect(computeBaselineFingerprint(scenarioA)).toBe(
      computeBaselineFingerprint(scenarioB)
    );
  });
});

describe("diffSummaryFromPatches", () => {
  it("summarizes event additions", () => {
    const payloadA: PlanLabSnapshotPayload = {
      ...basePayload,
      eventsPatch: {
        add: [
          {
            id: "event-1",
            type: "cashflow",
            kind: "expense",
            cadence: "monthly",
            amount: 500,
            startMonth: "2024-02",
            label: "Groceries",
          },
        ],
        update: [],
        remove: [],
      },
    };
    const payloadB: PlanLabSnapshotPayload = {
      ...basePayload,
      eventsPatch: { add: [], update: [], remove: [] },
    };

    const summary = diffSummaryFromPatches(payloadA, payloadB);
    expect(summary[0]).toContain("Only A");
    expect(summary[0]).toContain("Groceries");
  });
});
