import { describe, expect, it } from "vitest";
import { buildOnboardingCompletenessSummary } from "../completeness";
import { createInitialScenarioDraftV3State, type ScenarioDraftV3State } from "../types";

const buildDraft = (): ScenarioDraftV3State => {
  const draft = createInitialScenarioDraftV3State({ defaultMemberName: "Me" });
  draft.profile.startMonth = "2026-03";
  draft.profile.baseCurrency = "HKD";
  return draft;
};

describe("buildOnboardingCompletenessSummary", () => {
  it("marks a mostly empty onboarding draft as incomplete while treating auto salary as needs attention", () => {
    const draft = buildDraft();
    draft.events.push({
      id: "auto-salary",
      type: "cashflow",
      kind: "income",
      label: "Me Salary",
      amount: 20000,
      cadence: "monthly",
      startMonth: "2026-03",
      tags: ["onboarding:v3:income:salary:auto"],
    });

    const summary = buildOnboardingCompletenessSummary({ draft });

    expect(summary.level).toBe("incomplete");
    expect(summary.scorePct).toBe(30);
    expect(summary.groups.map((group) => [group.key, group.status])).toEqual([
      ["household", "complete"],
      ["income", "needs_attention"],
      ["fixedExpenses", "incomplete"],
      ["housing", "incomplete"],
      ["assetsLiabilities", "incomplete"],
    ]);
  });

  it("returns ready when all five completeness groups are covered by confirmed onboarding input", () => {
    const draft = buildDraft();
    draft.assets.push({
      id: "cash-1",
      assetType: "cash",
      kind: "cash",
      label: "Emergency fund",
      amount: 180000,
      currentValue: 180000,
      startMonth: "2026-03",
      currency: "HKD",
    });
    draft.events.push(
      {
        id: "salary-1",
        type: "cashflow",
        kind: "income",
        label: "Salary",
        amount: 35000,
        cadence: "monthly",
        startMonth: "2026-03",
        tags: ["onboarding:v3:income:salary"],
      },
      {
        id: "rent-1",
        type: "cashflow",
        kind: "expense",
        label: "Rent",
        amount: 14000,
        cadence: "monthly",
        startMonth: "2026-03",
        growthSource: "rentGrowth",
        tags: ["onboarding:v3:expense:other-fixed"],
      },
      {
        id: "daily-1",
        type: "cashflow",
        kind: "expense",
        label: "Daily living",
        amount: 9000,
        cadence: "monthly",
        startMonth: "2026-03",
        expenseCategory: "daily_living",
        tags: ["onboarding:v3:expense:daily-monthly"],
      }
    );

    const summary = buildOnboardingCompletenessSummary({ draft });

    expect(summary.level).toBe("ready");
    expect(summary.scorePct).toBe(100);
    expect(summary.groups.every((group) => group.status === "complete")).toBe(true);
  });

  it("returns needs_attention when housing basics exist but mortgage details are still incomplete", () => {
    const draft = buildDraft();
    draft.assets.push(
      {
        id: "property-1",
        assetType: "property",
        kind: "home",
        label: "Home",
        currentValue: 6800000,
        startMonth: "2026-03",
        usage: "self",
        mortgagePrincipalOutstanding: 3200000,
        holdingCostMonthly: 2400,
      },
      {
        id: "cash-1",
        assetType: "cash",
        kind: "cash",
        label: "Savings",
        amount: 300000,
        currentValue: 300000,
        startMonth: "2026-03",
        currency: "HKD",
      }
    );
    draft.events.push({
      id: "salary-1",
      type: "cashflow",
      kind: "income",
      label: "Salary",
      amount: 42000,
      cadence: "monthly",
      startMonth: "2026-03",
      tags: ["onboarding:v3:income:salary"],
    });

    const summary = buildOnboardingCompletenessSummary({ draft });

    expect(summary.level).toBe("needs_attention");
    expect(summary.groups.find((group) => group.key === "housing")?.status).toBe(
      "needs_attention"
    );
    expect(summary.groups.find((group) => group.key === "fixedExpenses")?.status).toBe(
      "complete"
    );
  });

  it("can fill completeness from active scenario context without relying on the engine", () => {
    const draft = buildDraft();

    const summary = buildOnboardingCompletenessSummary({
      draft,
      scenario: {
        members: [{ id: "self", name: "Me", kind: "person" }],
        assets: [],
        liabilities: [
          {
            id: "loan-1",
            kind: "loan",
            principalOutstanding: 120000,
            annualInterestRatePct: 4.2,
            termYears: 5,
            startMonth: "2026-03",
          },
        ],
        events: [
          {
            id: "salary-1",
            type: "cashflow",
            kind: "income",
            label: "Salary",
            amount: 28000,
            cadence: "monthly",
            startMonth: "2026-03",
          },
          {
            id: "daily-1",
            type: "cashflow",
            kind: "expense",
            label: "Daily living",
            amount: 10000,
            cadence: "monthly",
            startMonth: "2026-03",
            expenseCategory: "daily_living",
          },
          {
            id: "rent-1",
            type: "cashflow",
            kind: "expense",
            label: "Rent",
            amount: 12000,
            cadence: "monthly",
            startMonth: "2026-03",
            growthSource: "rentGrowth",
          },
        ],
      },
    });

    expect(summary.level).toBe("ready");
    expect(summary.groups.find((group) => group.key === "income")?.status).toBe("complete");
    expect(summary.groups.find((group) => group.key === "fixedExpenses")?.status).toBe(
      "complete"
    );
    expect(
      summary.groups.find((group) => group.key === "assetsLiabilities")?.status
    ).toBe("complete");
    expect(summary.groups.find((group) => group.key === "housing")?.status).toBe("complete");
  });
});
