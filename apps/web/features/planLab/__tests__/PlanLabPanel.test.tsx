import React from "react";
(globalThis as { React?: typeof React }).React = React;
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import PlanLabPanel from "../PlanLabPanel";
import type { EventDefinition } from "../../../src/domain/events/types";
import type { Scenario } from "../../../src/store/scenarioStore";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => {
    const translate = ((key: string) => key) as ((key: string) => string) & {
      has: (key: string) => boolean;
    };
    translate.has = () => false;
    return translate;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => undefined,
    replace: () => undefined,
    refresh: () => undefined,
  }),
}));

describe("PlanLabPanel", () => {
  it("PlanLab renders without infinite update loop", () => {
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

    expect(() =>
      renderToString(
        <MantineProvider><PlanLabPanel
          scenario={scenario}
          eventLibrary={eventLibrary}
          members={[]}
          budgetRules={[]}
          displayMode="nominal"
          deflateSeries={(series) => series}
          baselineSeries={{
            cash: [],
            netWorth: [],
            netCashflow: [],
          }}
        />
        </MantineProvider>
      )
    ).not.toThrow();
  });
});
