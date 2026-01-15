import { describe, expect, it } from "vitest";

import {
  computeProjection,
  expandEventToSeries,
  type ProjectionInput,
} from "../index";

describe("expandEventToSeries", () => {
  it("expands a recurring monthly event without growth", () => {
    const series = expandEventToSeries(
      {
        enabled: true,
        startMonth: "2025-01",
        endMonth: null,
        monthlyAmount: -1000,
      },
      "2025-01",
      24
    );

    expect(series).toHaveLength(24);
    for (const value of series) {
      expect(value).toBe(-1000);
    }
  });

  it("expands a one-time event at the start month", () => {
    const series = expandEventToSeries(
      {
        enabled: true,
        startMonth: "2025-03",
        endMonth: null,
        oneTimeAmount: -5000,
      },
      "2025-01",
      12
    );

    expect(series[2]).toBe(-5000);
    expect(series.filter((value) => value !== 0)).toEqual([-5000]);
  });

  it("applies annual growth compounding", () => {
    const series = expandEventToSeries(
      {
        enabled: true,
        startMonth: "2025-01",
        endMonth: null,
        monthlyAmount: -1000,
        annualGrowthPct: 0.1,
      },
      "2025-01",
      25
    );

    expect(series[0]).toBeCloseTo(-1000, 5);
    expect(series[12]).toBeCloseTo(-1100, 5);
    expect(series[24]).toBeCloseTo(-1210, 5);
  });
});

describe("computeProjection", () => {
  it("computes net cashflow and linear cash balance", () => {
    const input: ProjectionInput = {
      baseMonth: "2025-01",
      horizonMonths: 24,
      initialCash: 0,
      events: [
        {
          enabled: true,
          startMonth: "2025-01",
          endMonth: null,
          monthlyAmount: -1000,
        },
      ],
    };

    const result = computeProjection(input);

    for (const value of result.netCashflow) {
      expect(value).toBe(-1000);
    }

    for (let i = 0; i < result.cashBalance.length; i += 1) {
      expect(result.cashBalance[i]).toBe(-1000 * (i + 1));
    }
  });

  it("sums mixed events and finds lowest balance month", () => {
    const result = computeProjection({
      baseMonth: "2025-01",
      horizonMonths: 6,
      initialCash: 1000,
      events: [
        {
          enabled: true,
          startMonth: "2025-01",
          endMonth: null,
          monthlyAmount: 2000,
        },
        {
          enabled: true,
          startMonth: "2025-01",
          endMonth: null,
          monthlyAmount: -2500,
        },
      ],
    });

    expect(result.netCashflow).toEqual([-500, -500, -500, -500, -500, -500]);
    expect(result.lowestMonthlyBalance).toEqual({
      value: -2000,
      index: 5,
      month: "2025-06",
    });
  });

  it("assigns risk levels based on runway and balances", () => {
    const highRisk = computeProjection({
      baseMonth: "2025-01",
      horizonMonths: 3,
      initialCash: 0,
      events: [
        {
          enabled: true,
          startMonth: "2025-01",
          endMonth: null,
          monthlyAmount: -1000,
        },
      ],
    });

    const mediumRisk = computeProjection({
      baseMonth: "2025-01",
      horizonMonths: 1,
      initialCash: 5000,
      events: [
        {
          enabled: true,
          startMonth: "2025-01",
          endMonth: null,
          oneTimeAmount: -1000,
        },
      ],
    });

    const lowRisk = computeProjection({
      baseMonth: "2025-01",
      horizonMonths: 1,
      initialCash: 11000,
      events: [
        {
          enabled: true,
          startMonth: "2025-01",
          endMonth: null,
          oneTimeAmount: -1000,
        },
      ],
    });

    expect(highRisk.riskLevel).toBe("High");
    expect(mediumRisk.riskLevel).toBe("Medium");
    expect(lowRisk.riskLevel).toBe("Low");
  });

  it("handles existing homes without down payment and with rental income", () => {
    const result = computeProjection({
      baseMonth: "2025-01",
      horizonMonths: 2,
      initialCash: 0,
      events: [],
      positions: {
        homes: [
          {
            mode: "existing",
            annualAppreciation: 0,
            existing: {
              asOfMonth: "2025-01",
              marketValue: 100000,
              mortgageBalance: 50000,
              remainingTermMonths: 1,
              annualRate: 0,
            },
            rental: {
              rentMonthly: 1000,
              rentStartMonth: "2025-01",
            },
          },
        ],
      },
    });

    expect(result.assets.housing[0]).toBeCloseTo(100000, 2);
    expect(result.liabilities.mortgage[0]).toBeCloseTo(0, 2);
    expect(result.netCashflow[0]).toBeCloseTo(-49000, 2);
  });
});
