import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import ScenarioSettingsWorkspace from "../ScenarioSettingsWorkspace";

(globalThis as { React?: typeof React }).React = React;

const scenario = {
  id: "scenario-1",
  name: "Test",
  baseCurrency: "HKD",
  updatedAt: Date.now(),
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Low" as const,
  },
  assumptions: {
    horizonMonths: 240,
    initialCash: 0,
    baseMonth: "2026-01",
  },
  eventRefs: [],
  events: [
    {
      id: "event-salary-a",
      type: "cashflow" as const,
      kind: "income" as const,
      cadence: "monthly" as const,
      amount: 30000,
      startMonth: "2026-01",
      memberId: "member-a",
      label: "Salary A",
    },
    {
      id: "event-salary-b",
      type: "cashflow" as const,
      kind: "income" as const,
      cadence: "monthly" as const,
      amount: 28000,
      startMonth: "2026-01",
      memberId: "member-b",
      label: "Salary B",
    },
  ],
};

const mockState = {
  scenarios: [scenario],
  eventLibrary: [
    {
      id: "event-salary-a",
      title: "Salary A",
      type: "salary",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: "2026-01",
        endMonth: null,
        monthlyAmount: 30000,
        oneTimeAmount: 0,
      },
      memberId: undefined,
    },
    {
      id: "event-salary-b",
      title: "Salary B",
      type: "salary",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: "2026-01",
        endMonth: null,
        monthlyAmount: 28000,
        oneTimeAmount: 0,
      },
      memberId: undefined,
    },
  ],
  members: [
    { id: "member-a", name: "Alice", kind: "person", ageAtBaseMonth: 30 },
    { id: "member-b", name: "Bob", kind: "person", ageAtBaseMonth: 32 },
  ],
  appSettings: {
    globalBaseMonth: "2026-01",
    globalHorizonMonths: 240,
    annualInflationPct: 2,
    viewMode: "nominal" as const,
  },
  budgetRules: [],
  createMember: () => undefined,
  updateMember: () => undefined,
  deleteMember: () => undefined,
  setMemberApplyScope: () => undefined,
  createBudgetRule: () => undefined,
  updateBudgetRule: () => undefined,
  removeBudgetRule: () => undefined,
  updateScenarioAssumptions: () => undefined,
  upsertEventDefinition: () => undefined,
  upsertScenarioEventRef: () => undefined,
};

vi.mock("next-intl", () => ({
  useLocale: () => "zh-HK",
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values?.count ? `${key}:${String(values.count)}` : key,
}));

vi.mock("../../../src/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("../../../src/hooks/useScenarioContext", () => ({
  useScenarioContext: () => ({ caseId: "case-1", scenarioId: "scenario-1" }),
}));

vi.mock("../../../src/engine/useProjectionWithLedger", () => ({
  useProjectionWithLedger: () => ({ projection: null, ledgerRowsByEventId: new Map() }),
}));

vi.mock("../../../src/store/scenarioStore", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getScenarioById: () => scenario,
    resolveScenarioIdFromQuery: () => "scenario-1",
    createMemberId: () => "member-new",
    useScenarioStore: (selector?: (state: typeof mockState) => unknown) =>
      selector ? selector(mockState) : mockState,
  };
});


describe("ScenarioSettingsWorkspace members tab", () => {
  it("shows member events from scenario.events even when eventRefs are empty", () => {
    const html = renderToString(
      React.createElement(
        MantineProvider,
        null,
        React.createElement(ScenarioSettingsWorkspace, {
          scenarioId: "scenario-1",
          defaultTab: "members",
        })
      )
    );

    expect(html).toContain("Salary A");
    expect(html).toContain("Salary B");
    expect(html).not.toContain("memberEventsEmpty");
  });
});
