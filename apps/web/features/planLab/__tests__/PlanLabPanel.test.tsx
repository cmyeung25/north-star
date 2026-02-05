import React from "react";
(globalThis as { React?: typeof React }).React = React;
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import PlanLabPanel, { GROUP_LABEL, buildScenarioItemMetaParts } from "../PlanLabPanel";
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

const renderPlanLab = (initialMode?: "edit" | "compare") =>
  renderToString(
    <MantineProvider>
      <PlanLabPanel
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
        initialMode={initialMode}
      />
    </MantineProvider>
  );

describe("PlanLabPanel", () => {
  it("PlanLab renders without infinite update loop", () => {
    expect(() => renderPlanLab()).not.toThrow();
  });

  it("PlanLab compare with snapshot renders without infinite loop", () => {
    const html = renderPlanLab("compare");

    expect(html).toContain("Impact KPIs");
    expect(() => renderPlanLab("compare")).not.toThrow();
  });

  it("renders KPI current and baseline values in separate containers", () => {
    const html = renderPlanLab("compare");

    const currentContainerCount = (html.match(/data-testid="kpi-current"/g) ?? []).length;
    const baselineContainerCount = (html.match(/data-testid="kpi-baseline"/g) ?? []).length;

    expect(currentContainerCount > 0).toBe(true);
    expect(baselineContainerCount > 0).toBe(true);
    expect(currentContainerCount).toBe(baselineContainerCount);
  });

  it("maps income/expense group labels to localized text", () => {
    expect(GROUP_LABEL.income).toBe("收入");
    expect(GROUP_LABEL.expense).toBe("支出");
  });

  it("builds meta line without undefined/null placeholders", () => {
    const meta = buildScenarioItemMetaParts({
      item: {
        id: "event:salary",
        kind: "event",
        title: "Salary",
        category: "income",
        enabled: true,
        amount: 5000,
        frequency: "monthly",
        startMonth: "2026-02",
        memberName: "家庭",
      },
      currency: "HKD",
      locale: "zh-HK",
      frequencyLabels: {
        monthly: "每月",
        quarterly: "每季",
        yearly: "每年",
        oneOff: "一次性",
        everyNMonths: "每 N 個月",
        schedule: "排程",
      },
      householdLabel: "家庭",
    }).join(" • ");

    expect(meta).toContain("每月");
    expect(meta).toContain("2026-02 起");
    expect(meta).not.toContain("undefined");
    expect(meta).not.toContain("null");
  });
});
