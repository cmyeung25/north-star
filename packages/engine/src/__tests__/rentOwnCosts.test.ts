import { describe, expect, it } from "vitest";

import { computeProjection, type ProjectionInput } from "../index";

describe("rent vs own costs", () => {
  it("applies feesOneTime in the purchase month", () => {
    const input: ProjectionInput = {
      baseMonth: "2026-01",
      horizonMonths: 2,
      initialCash: 1_000_000,
      events: [],
      positions: {
        homes: [
          {
            purchasePrice: 0,
            annualAppreciation: 0,
            purchaseMonth: "2026-01",
            downPayment: 0,
            feesOneTime: 300_000,
          },
        ],
      },
    };

    const result = computeProjection(input);

    expect(result.cashBalance[0]).toBe(700_000);
  });

  it("applies holding costs with annual growth", () => {
    const input: ProjectionInput = {
      baseMonth: "2026-01",
      horizonMonths: 13,
      initialCash: 0,
      events: [],
      positions: {
        homes: [
          {
            purchasePrice: 0,
            annualAppreciation: 0,
            purchaseMonth: "2026-01",
            downPayment: 0,
            holdingCostMonthly: 5_000,
            holdingCostAnnualGrowth: 0.12,
          },
        ],
      },
    };

    const result = computeProjection(input);

    const month0Cost = Math.abs(result.netCashflow[0] ?? 0);
    const month12Cost = Math.abs(result.netCashflow[12] ?? 0);

    expect(month12Cost).toBeGreaterThan(month0Cost);
  });
});
