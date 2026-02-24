import { describe, expect, it } from "vitest";
import { compileEventToMonthlyCashflowSeries } from "../compiler";
import type { EventDefinition, ScenarioEventRef } from "../types";

const buildDefinition = (
  overrides: Partial<EventDefinition> = {}
): EventDefinition => ({
  id: "salary-event",
  title: "Salary",
  type: "salary",
  kind: "cashflow",
  rule: {
    mode: "params",
    startMonth: "2026-01",
    endMonth: "2026-12",
    monthlyAmount: 20000,
    annualGrowthPct: 0,
    salarySteps: [],
  },
  ...overrides,
});

const buildRef = (overrides: Partial<ScenarioEventRef> = {}): ScenarioEventRef => ({
  refId: "salary-event",
  enabled: true,
  ...overrides,
});

const assumptions = { baseMonth: "2026-01", horizonMonths: 24 };
const signByType = () => 1 as const;

describe("compileEventToMonthlyCashflowSeries (salary)", () => {

  it("uses schedule entries for schedule-driven salary events", () => {
    const definition = buildDefinition({
      rule: {
        mode: "schedule",
        startMonth: "2026-01",
        endMonth: "2026-03",
        monthlyAmount: 1000,
        salarySteps: [
          {
            id: "step-1",
            basis: "month",
            startMonth: "2026-02",
            monthlyAmount: 50000,
          },
        ],
        schedule: [
          { month: "2026-01", amount: 30000 },
          { month: "2026-02", amount: 31000 },
          { month: "2026-03", amount: 32000 },
        ],
      },
    });

    const series = compileEventToMonthlyCashflowSeries({
      definition,
      ref: buildRef(),
      assumptions,
      signByType,
    });

    expect(series).toHaveLength(24);
    expect(series[0]?.amount).toBe(30000);
    expect(series[1]?.amount).toBe(31000);
    expect(series[2]?.amount).toBe(32000);
    expect(series[3]?.amount).toBe(0);
  });
  it("applies salary steps within an endMonth range", () => {
    const definition = buildDefinition({
      rule: {
        mode: "params",
        startMonth: "2026-01",
        endMonth: "2026-12",
        monthlyAmount: 20000,
        annualGrowthPct: 0,
        salarySteps: [
          {
            id: "step-1",
            basis: "month",
            startMonth: "2026-06",
            monthlyAmount: 25000,
          },
        ],
      },
    });

    const series = compileEventToMonthlyCashflowSeries({
      definition,
      ref: buildRef(),
      assumptions,
      signByType,
    });

    expect(series).toHaveLength(12);
    expect(series[0]?.amount).toBe(20000);
    expect(series[4]?.amount).toBe(20000);
    expect(series[5]?.amount).toBe(25000);
    expect(series[11]?.amount).toBe(25000);
  });

  it("emits zero amounts before a step when base is zero", () => {
    const definition = buildDefinition({
      rule: {
        mode: "params",
        startMonth: "2026-01",
        endMonth: "2026-06",
        monthlyAmount: 0,
        annualGrowthPct: 0,
        salarySteps: [
          {
            id: "step-1",
            basis: "month",
            startMonth: "2026-03",
            monthlyAmount: 18000,
          },
        ],
      },
    });

    const series = compileEventToMonthlyCashflowSeries({
      definition,
      ref: buildRef(),
      assumptions,
      signByType,
    });

    expect(series).toHaveLength(6);
    expect(series[0]?.amount).toBe(0);
    expect(series[1]?.amount).toBe(0);
    expect(series[2]?.amount).toBe(18000);
  });

  it("does not double count a step at the start month", () => {
    const definition = buildDefinition({
      rule: {
        mode: "params",
        startMonth: "2026-01",
        endMonth: "2026-03",
        monthlyAmount: 0,
        annualGrowthPct: 0,
        salarySteps: [
          {
            id: "step-1",
            basis: "month",
            startMonth: "2026-01",
            monthlyAmount: 22000,
          },
        ],
      },
    });

    const series = compileEventToMonthlyCashflowSeries({
      definition,
      ref: buildRef(),
      assumptions,
      signByType,
    });

    expect(series[0]?.amount).toBe(22000);
  });

  it("ignores salary steps for non-salary income subtypes", () => {
    const definition = buildDefinition({
      incomeSubtype: "bonus",
      rule: {
        mode: "params",
        startMonth: "2026-01",
        endMonth: "2026-03",
        monthlyAmount: 12000,
        annualGrowthPct: 0,
        salarySteps: [
          {
            id: "step-1",
            basis: "month",
            startMonth: "2026-02",
            monthlyAmount: 20000,
          },
        ],
      },
    });

    const series = compileEventToMonthlyCashflowSeries({
      definition,
      ref: buildRef(),
      assumptions,
      signByType,
    });

    expect(series).toHaveLength(3);
    expect(series[0]?.amount).toBe(12000);
    expect(series[1]?.amount).toBe(12000);
  });
});
