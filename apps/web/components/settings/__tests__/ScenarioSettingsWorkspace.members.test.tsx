import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import ScenarioSettingsWorkspace, {
  buildMemberFromAddDraft,
  buildMemberPatchFromDraft,
  persistNewMember,
  validateAddMemberDraft,
  type AddMemberDraft,
} from "../ScenarioSettingsWorkspace";

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

vi.mock("../../../src/store/scenarioStore", () => ({
  getScenarioById: () => scenario,
  resolveScenarioIdFromQuery: () => "scenario-1",
  createMemberId: () => "member-new",
  selectPersistedState: (state: typeof mockState) => state,
  useScenarioStore: (selector?: (state: typeof mockState) => unknown) =>
    selector ? selector(mockState) : mockState,
}));


describe("ScenarioSettingsWorkspace members tab", () => {
  it("shows member ownership and shared tag semantics for scenario events", () => {
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
    expect(html).toContain("Alice");
    expect(html).toContain("memberEventsTagSourceBaselineOnly");
    expect(html).not.toContain("memberEventsEmpty");
  });


  it("renders member accordion as read-only and exposes edit action", () => {
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

    expect(html).toContain("editMember");
    expect(html).not.toContain("name=\"nameLabel\"");
    expect(html).not.toContain("name=\"kindLabel\"");
  });

  it("buildMemberPatchFromDraft only commits changed values on save", () => {
    expect(
      buildMemberPatchFromDraft({
        name: "  Alice Updated  ",
        kind: "person",
        basis: "month",
        birthMonth: "2024-1",
        ageAtBaseMonth: "",
      })
    ).toEqual({
      name: "Alice Updated",
      kind: "person",
      birthMonth: "2024-01",
      ageAtBaseMonth: undefined,
    });

    expect(
      buildMemberPatchFromDraft({
        name: "Bob",
        kind: "pet",
        basis: "age",
        birthMonth: "",
        ageAtBaseMonth: "5.5",
      })
    ).toEqual({
      name: "Bob",
      kind: "pet",
      birthMonth: undefined,
      ageAtBaseMonth: 5.5,
    });
  });
  it("requires required modal fields before submit", () => {
    const invalidDraft: AddMemberDraft = {
      name: "",
      kind: "person",
      basis: "month",
      birthMonth: "",
      ageAtBaseMonth: "",
    };

    const result = validateAddMemberDraft(invalidDraft, {
      requiredName: "memberNameRequired",
      requiredAgeOrMonth: "memberBirthOrAgeRequired",
      invalidMonth: "useYearMonth",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBe("memberNameRequired");
    expect(result.errors.birthMonth).toBe("memberBirthOrAgeRequired");
  });

  it("builds complete member payload from modal draft", () => {
    const draft: AddMemberDraft = {
      name: "  Charlie  ",
      kind: "person",
      basis: "month",
      birthMonth: "2024-1",
      ageAtBaseMonth: "",
    };

    const member = buildMemberFromAddDraft(draft, {
      createId: () => "member-new",
    });

    expect(member).toMatchObject({
      id: "member-new",
      name: "Charlie",
      kind: "person",
      birthMonth: "2024-01",
      ageAtBaseMonth: undefined,
      applyScope: { scope: "all" },
    });
    expect(member.milestones).toHaveLength(0);
  });

  it("persistNewMember only creates member without event/budget side effects", () => {
    const member = buildMemberFromAddDraft(
      {
        name: "Casey",
        kind: "person",
        basis: "age",
        birthMonth: "",
        ageAtBaseMonth: "29",
      },
      {
        createId: () => "member-casey",
      }
    );

    let createMemberCalls = 0;
    let createMemberPayload: unknown = null;
    let createBudgetRuleCalls = 0;
    let upsertEventDefinitionCalls = 0;
    let upsertScenarioEventRefCalls = 0;

    persistNewMember(member, {
      createMember: (payload) => {
        createMemberCalls += 1;
        createMemberPayload = payload;
      },
      createBudgetRule: () => {
        createBudgetRuleCalls += 1;
      },
      upsertEventDefinition: () => {
        upsertEventDefinitionCalls += 1;
      },
      upsertScenarioEventRef: () => {
        upsertScenarioEventRefCalls += 1;
      },
    });

    expect(createMemberCalls).toBe(1);
    expect(createMemberPayload).toEqual(member);
    expect(createBudgetRuleCalls).toBe(0);
    expect(upsertEventDefinitionCalls).toBe(0);
    expect(upsertScenarioEventRefCalls).toBe(0);
  });
});
