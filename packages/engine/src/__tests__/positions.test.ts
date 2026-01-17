import { describe, expect, it } from "vitest";

import { calcFixedMonthlyPayment } from "../amortization";
import { computeProjection, type ProjectionInput } from "../index";

const buildBaseInput = (overrides: Partial<ProjectionInput> = {}): ProjectionInput => ({
  baseMonth: "2025-01",
  horizonMonths: 3,
  initialCash: 0,
  events: [],
  ...overrides,
});

describe("loan positions", () => {
  it("amortizes loan balances with monthly payments", () => {
    const payment = calcFixedMonthlyPayment(1200, 0.12, 12);
    const result = computeProjection(
      buildBaseInput({
        positions: {
          loans: [
            {
              id: "loan-1",
              startMonth: "2025-01",
              principal: 1200,
              annualInterestRate: 0.12,
              termMonths: 12,
            },
          ],
        },
      })
    );

    expect(result.netCashflow[0]).toBeCloseTo(-payment, 2);
    expect(result.liabilities.loans[0]).toBeGreaterThan(result.liabilities.loans[1]);
    expect(result.liabilities.loans[1]).toBeGreaterThan(result.liabilities.loans[2]);
  });

  it("guards against negative amortization when payment is too low", () => {
    const result = computeProjection(
      buildBaseInput({
        positions: {
          loans: [
            {
              id: "loan-2",
              startMonth: "2025-01",
              principal: 1000,
              annualInterestRate: 0.12,
              termMonths: 2,
              monthlyPayment: 1,
            },
          ],
        },
      })
    );

    expect(result.netCashflow[0]).toBeCloseTo(-1, 5);
    expect(result.liabilities.loans[0]).toBeGreaterThan(1000);
  });
});

describe("investment positions", () => {
  it("applies contributions and compounding returns", () => {
    const result = computeProjection(
      buildBaseInput({
        initialCash: 1000,
        positions: {
          investments: [
            {
              id: "invest-1",
              startMonth: "2025-01",
              initialValue: 100,
              annualReturnRate: -0.12,
              monthlyContribution: 50,
            },
          ],
        },
      })
    );

    expect(result.netCashflow[0]).toBeCloseTo(-50, 2);
    expect(result.cashBalance[0]).toBeCloseTo(950, 2);
    expect(result.assets.investments[0]).toBeLessThan(150);
  });
});

describe("car positions", () => {
  it("tracks depreciation and holding cost growth", () => {
    const result = computeProjection(
      buildBaseInput({
        horizonMonths: 3,
        positions: {
          cars: [
            {
              id: "car-1",
              purchaseMonth: "2025-01",
              purchasePrice: 12000,
              downPayment: 2000,
              annualDepreciationRate: -0.12,
              holdingCostMonthly: 100,
              holdingCostAnnualGrowth: 0.12,
            },
          ],
        },
      })
    );

    expect(result.assets.cars[1]).toBeLessThan(result.assets.cars[0]);
    expect(result.assets.cars[2]).toBeLessThan(result.assets.cars[1]);
    expect(result.netCashflow[2]).toBeLessThan(result.netCashflow[1]);
  });
});
