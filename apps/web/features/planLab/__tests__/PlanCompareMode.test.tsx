import React from "react";
(globalThis as { React?: typeof React }).React = React;
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { PlanCompareMode } from "../PlanCompareMode";
import type { EventDefinition } from "../../../src/domain/events/types";
import type { PlanSnapshot } from "../../../src/domain/planLab/types";
import type { Scenario } from "../../../src/store/scenarioStore";

const scenario: Scenario = {
  id: "scenario-1",
  name: "Base",
  baseCurrency: "USD",
  updatedAt: 1716806400000,
  assumptions: {
    horizonMonths: 24,
    initialCash: 120000,
    baseMonth: "2024-01",
    inflationRate: 2,
  },
  kpis: {
    lowestMonthlyBalance: 100000,
    runwayMonths: 24,
    netWorthYear5: 900000,
    riskLevel: "Medium",
  },
  eventRefs: [{ refId: "event-1", enabled: true, highlighted: false }],
  positions: {
    homes: [],
    cars: [],
    investments: [],
    insurances: [],
    loans: [],
    cashBuckets: [],
  },
};

const eventLibrary: EventDefinition[] = [
  {
    id: "event-1",
    title: "Salary",
    type: "salary",
    kind: "cashflow",
    currency: "USD",
    rule: {
      mode: "params",
      startMonth: "2024-01",
      endMonth: null,
      monthlyAmount: 40000,
      oneTimeAmount: 0,
      annualGrowthPct: 0,
    },
  },
];

const snapshotPlan: PlanSnapshot = {
  id: "snapshot-1",
  name: "Snapshot Plan",
  createdAt: 1716806400000,
  updatedAt: 1716806400000,
  baselineScenarioId: "scenario-1",
  baselineSignature: "sig-1",
  payload: {
    eventsPatch: { add: [], update: [], remove: [] },
  },
  snapshot: {},
};

describe("PlanCompareMode", () => {
  it("PlanLab compare with snapshot renders without infinite loop", () => {
    expect(() =>
      renderToString(
        <MantineProvider>
          <PlanCompareMode
            scenario={scenario}
            plans={[snapshotPlan]}
            planAId="baseline"
            planBId="snapshot-1"
            onPlanAChange={() => undefined}
            onPlanBChange={() => undefined}
            onSwapPlans={() => undefined}
            onLoadPlan={() => undefined}
            baselineSignature="sig-1"
            displayMode="nominal"
            deflateSeries={(series) => series}
            locale="en"
            eventLibrary={eventLibrary}
            members={[]}
            budgetRules={[]}
            translate={(_key, fallback) => fallback}
          />
        </MantineProvider>
      )
    ).not.toThrow();
  });
});
