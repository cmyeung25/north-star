import { describe, expect, it } from "vitest";

import { computeMortgageSchedule } from "../mortgage";
import { computeProjection, type ProjectionInput } from "../index";

describe("home positions", () => {
  it("keeps purchase cashflow aligned with mortgage schedule", () => {
    const input: ProjectionInput = {
      baseMonth: "2026-01",
      horizonMonths: 2,
      initialCash: 0,
      events: [],
      positions: {
        homes: [
          {
            id: "home-1",
            purchasePrice: 1_000_000,
            downPayment: 200_000,
            purchaseMonth: "2026-01",
            annualAppreciation: 0,
            feesOneTime: 10_000,
            mortgage: {
              principal: 800_000,
              annualRate: 0.06,
              termMonths: 360,
            },
          },
        ],
      },
    };

    const result = computeProjection(input);
    const schedule = computeMortgageSchedule({
      principal: 800_000,
      annualRate: 0.06,
      termMonths: 360,
      startIndex: 0,
      horizonMonths: 2,
    });
    const paymentMonth0 = schedule.interestSeries[0] + schedule.principalSeries[0];

    expect(result.netCashflow[0]).toBeCloseTo(-210_000 - paymentMonth0, 2);
  });
});
