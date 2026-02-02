import { describe, expect, it } from "vitest";
import { computeProjection } from "@north-star/engine";
import type { ScenarioV2 } from "../../../engine/scenarioV2Compiler";
import { compileScenarioV2ToProjectionInput } from "../../../engine/scenarioV2Compiler";
import {
  applyPlanLabScenarioV2Patches,
  emptyPlanLabScenarioV2Patches,
} from "../scenarioV2Patches";

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

describe("applyPlanLabScenarioV2Patches", () => {
  it("applies added events to the sandbox scenario", () => {
    const baseline = buildScenario();
    const patches = emptyPlanLabScenarioV2Patches();
    patches.events.add.push({
      id: "event-1",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 5000,
      startMonth: "2024-01",
      label: "Salary",
    });

    const result = applyPlanLabScenarioV2Patches(baseline, patches);
    expect(result.events).toHaveLength(1);
    expect(result.events?.[0]?.id).toBe("event-1");
  });

  it("produces a projection with non-flat cash balance after adding income", () => {
    const baseline = buildScenario();
    const patches = emptyPlanLabScenarioV2Patches();
    patches.events.add.push({
      id: "event-2",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 8000,
      startMonth: "2024-01",
      label: "Income",
    });

    const sandbox = applyPlanLabScenarioV2Patches(baseline, patches);
    const input = compileScenarioV2ToProjectionInput(sandbox);
    const projection = computeProjection(input);
    const cashValues = new Set(projection.cashBalance);
    expect(cashValues.size > 1).toBe(true);
  });
});
