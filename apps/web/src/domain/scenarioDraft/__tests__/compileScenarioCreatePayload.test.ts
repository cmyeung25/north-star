import { describe, expect, it } from "vitest";
import { compileScenarioCreatePayload } from "../compileScenarioCreatePayload";
import { validateScenarioDraftV3 } from "../validateScenarioDraftV3";
import type { ScenarioDraftV3 } from "../types";

const buildDraft = (): ScenarioDraftV3 => ({
  profile: {
    baseCurrency: "HKD",
    startMonth: "2025-01",
    horizonMonths: 120,
  },
  income: {
    salaryMonthly: 50000,
    salaryGrowthRatePct: 3,
  },
  assumptions: {
    initialCash: 100000,
  },
  assets: [
    {
      id: "asset-home",
      kind: "home",
      label: "Home",
      currency: "HKD",
      startMonth: "2025-01",
      source: "manual",
    },
  ],
  liabilities: [
    {
      id: "liability-mortgage",
      kind: "mortgage",
      principalOutstanding: 2000000,
      annualInterestRatePct: 3.5,
      termYears: 30,
      startMonth: "2025-01",
      source: "manual",
    },
  ],
  meta: {
    onboarded: true,
  },
  clientComputed: {
    onboardingCompleted: true,
  },
});

describe("validateScenarioDraftV3", () => {
  it("validates required fields and mortgage consistency", () => {
    const { issues } = validateScenarioDraftV3({
      profile: { baseCurrency: "", startMonth: "2025-13", horizonMonths: 0 },
      income: { salaryMonthly: -1 },
      liabilities: [{ id: "l1", kind: "mortgage", annualInterestRatePct: 3 }],
    });

    const issueCodes = issues.map((issue) => issue.code);
    expect(issueCodes).toContain("required");
    expect(issueCodes).toContain("invalid-month");
    expect(issueCodes).toContain("invalid-number");
    expect(issueCodes).toContain("inconsistent-mortgage");
  });
});

describe("compileScenarioCreatePayload", () => {
  it("produces consistent structure for onboarding, seed, and plan-lab paths", () => {
    const draft = buildDraft();
    const onboarding = compileScenarioCreatePayload(draft, { nowIso: "2026-01-01T00:00:00.000Z" });
    const seed = compileScenarioCreatePayload(draft, { nowIso: "2026-01-01T00:00:00.000Z" });
    const planLab = compileScenarioCreatePayload(draft, { nowIso: "2026-01-01T00:00:00.000Z" });

    const shape = ({
      assumptions,
      members,
      assets,
      liabilities,
      events,
      meta,
      clientComputed,
      baseCurrency,
    }: ReturnType<typeof compileScenarioCreatePayload>) => ({
      assumptions,
      members,
      assets,
      liabilities,
      events,
      meta,
      clientComputed,
      baseCurrency,
    });

    expect(shape(onboarding)).toEqual(shape(seed));
    expect(shape(onboarding)).toEqual(shape(planLab));
  });
});
