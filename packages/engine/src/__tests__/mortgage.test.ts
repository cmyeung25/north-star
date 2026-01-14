import { describe, expect, it } from "vitest";

import {
  computeMortgageSchedule,
  computeProjection,
  type ProjectionInput,
} from "../index";

describe("computeMortgageSchedule", () => {
  it("handles zero rate mortgages", () => {
    const schedule = computeMortgageSchedule({
      principal: 1_000_000,
      annualRate: 0,
      termMonths: 10,
      startIndex: 0,
      horizonMonths: 12,
    });

    expect(schedule.paymentMonthly).toBeCloseTo(100_000, 5);
    for (let i = 0; i < 10; i += 1) {
      expect(schedule.interestSeries[i]).toBe(0);
      expect(schedule.principalSeries[i]).toBeCloseTo(100_000, 5);
    }
    expect(schedule.balanceSeries[9]).toBeCloseTo(0, 5);
    expect(schedule.balanceSeries[10]).toBe(0);
  });

  it("matches fixed-rate amortization math", () => {
    const principal = 100_000;
    const annualRate = 0.12;
    const termMonths = 12;
    const monthlyRate = annualRate / 12;
    const expectedPayment =
      (principal * monthlyRate) /
      (1 - Math.pow(1 + monthlyRate, -termMonths));

    const schedule = computeMortgageSchedule({
      principal,
      annualRate,
      termMonths,
      startIndex: 0,
      horizonMonths: 12,
    });

    expect(schedule.paymentMonthly).toBeCloseTo(expectedPayment, 6);
    expect(schedule.balanceSeries[0]).toBeLessThan(principal);
    expect(schedule.balanceSeries[11]).toBeCloseTo(0, 4);
  });
});

describe("home positions", () => {
  it("reduces net worth primarily by interest after purchase", () => {
    const input: ProjectionInput = {
      baseMonth: "2025-01",
      horizonMonths: 3,
      initialCash: 50_000,
      events: [],
      positions: {
        home: {
          purchasePrice: 100_000,
          annualAppreciation: 0,
          purchaseMonth: "2025-01",
          downPayment: 20_000,
          mortgage: {
            principal: 80_000,
            annualRate: 0.12,
            termMonths: 12,
          },
        },
      },
    };

    const result = computeProjection(input);
    const schedule = computeMortgageSchedule({
      principal: 80_000,
      annualRate: 0.12,
      termMonths: 12,
      startIndex: 0,
      horizonMonths: 3,
    });

    const paymentMonth0 =
      schedule.interestSeries[0] + schedule.principalSeries[0];
    expect(result.cashBalance[0]).toBeCloseTo(
      50_000 - 20_000 - paymentMonth0,
      4
    );

    expect(result.liabilities.mortgage).toEqual(schedule.balanceSeries);
    expect(result.netWorth[1]).toBeCloseTo(
      result.netWorth[0] - schedule.interestSeries[1],
      4
    );
  });

  it("increases net worth with appreciation", () => {
    const input: ProjectionInput = {
      baseMonth: "2025-01",
      horizonMonths: 13,
      initialCash: 0,
      events: [],
      positions: {
        home: {
          purchasePrice: 200_000,
          annualAppreciation: 0.06,
          purchaseMonth: "2025-01",
          downPayment: 0,
        },
      },
    };

    const result = computeProjection(input);

    expect(result.netWorth[12]).toBeGreaterThan(result.netWorth[0]);
  });
});
