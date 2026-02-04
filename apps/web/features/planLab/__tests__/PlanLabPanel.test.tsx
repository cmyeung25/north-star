import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import PlanLabPanel from "../PlanLabPanel";
import type { Scenario } from "../../../src/store/scenarioStore";
import type { EventDefinition } from "../../../src/domain/events/types";

Object.assign(globalThis, { React });

vi.mock("next-intl", () => {
  const createTranslator = () => {
    const translate = ((key: string) => key) as ((key: string) => string) & {
      has: (key: string) => boolean;
    };
    translate.has = () => false;
    return translate;
  };
  return {
    useTranslations: createTranslator,
    useLocale: () => "en",
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => undefined,
  }),
}));

const buildScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "scenario-plan-lab",
  name: "Plan Lab Scenario",
  baseCurrency: "USD",
  updatedAt: 1716806400000,
  kpis: {
    lowestMonthlyBalance: -5000,
    runwayMonths: 12,
    netWorthYear5: 500000,
    riskLevel: "Medium",
  },
  assumptions: {
    horizonMonths: 240,
    initialCash: 10000,
    baseMonth: "2024-01",
    inflationRate: 2,
  },
  eventRefs: [
    {
      refId: "event-1",
      enabled: true,
      highlighted: false,
    },
  ],
  positions: {
    homes: [
      {
        id: "home-1",
        purchasePrice: 600000,
        downPayment: 120000,
        purchaseMonth: "2025-06",
        annualAppreciationPct: 3,
        mortgageRatePct: 5,
        mortgageTermYears: 30,
        feesOneTime: 8000,
        holdingCostMonthly: 350,
        holdingCostAnnualGrowthPct: 2,
      },
    ],
  },
  plans: [],
  ...overrides,
});

const buildEventLibrary = (): EventDefinition[] => [
  {
    id: "event-1",
    title: "Starter Rent",
    type: "rent",
    kind: "cashflow",
    rule: {
      mode: "params",
      startMonth: "2024-01",
      endMonth: null,
      monthlyAmount: 1800,
      oneTimeAmount: 0,
      annualGrowthPct: 2,
    },
    currency: "USD",
  },
];

describe("PlanLabPanel", () => {
  it("renders without throwing", () => {
    const scenario = buildScenario();
    const eventLibrary = buildEventLibrary();

    const html = renderToString(
      React.createElement(
        MantineProvider,
        null,
        React.createElement(PlanLabPanel, {
          scenario,
          eventLibrary,
          members: [],
          budgetRules: [],
          displayMode: "nominal",
          deflateSeries: (series) => series,
          baselineSeries: {
            cash: [{ month: "2024-01", value: 0 }],
            netWorth: [{ month: "2024-01", value: 0 }],
            netCashflow: [{ month: "2024-01", value: 0 }],
          },
        })
      )
    );

    expect(html).toContain("planLab");
  });
});
