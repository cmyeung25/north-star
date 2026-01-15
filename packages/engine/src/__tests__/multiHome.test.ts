import { describe, expect, it } from "vitest";

import {
  computeMortgageSchedule,
  computeProjection,
  type ProjectionInput,
} from "../index";

describe("multi-home positions", () => {
  it("aggregates housing assets and mortgage liabilities across homes", () => {
    const input: ProjectionInput = {
      baseMonth: "2026-01",
      horizonMonths: 1,
      events: [],
      positions: {
        homes: [
          {
            purchasePrice: 10_000_000,
            annualAppreciation: 0,
            purchaseMonth: "2026-01",
            downPayment: 2_000_000,
            mortgage: {
              principal: 8_000_000,
              annualRate: 0.05,
              termMonths: 360,
            },
          },
          {
            purchasePrice: 6_000_000,
            annualAppreciation: 0,
            purchaseMonth: "2026-01",
            downPayment: 1_000_000,
            mortgage: {
              principal: 5_000_000,
              annualRate: 0.04,
              termMonths: 360,
            },
          },
        ],
      },
    };

    const result = computeProjection(input);

    const scheduleA = computeMortgageSchedule({
      principal: 8_000_000,
      annualRate: 0.05,
      termMonths: 360,
      startIndex: 0,
      horizonMonths: 1,
    });
    const scheduleB = computeMortgageSchedule({
      principal: 5_000_000,
      annualRate: 0.04,
      termMonths: 360,
      startIndex: 0,
      horizonMonths: 1,
    });

    expect(result.assets.housing[0]).toBeCloseTo(16_000_000, 2);
    expect(result.liabilities.mortgage[0]).toBeCloseTo(
      scheduleA.balanceSeries[0] + scheduleB.balanceSeries[0],
      4
    );
  });

  it("normalizes legacy positions.home into homes[0]", () => {
    const legacyInput: ProjectionInput = {
      baseMonth: "2026-01",
      horizonMonths: 2,
      events: [],
      positions: {
        home: {
          purchasePrice: 9_000_000,
          annualAppreciation: 0,
          purchaseMonth: "2026-01",
          downPayment: 1_000_000,
        },
      },
    };

    const homesInput: ProjectionInput = {
      baseMonth: "2026-01",
      horizonMonths: 2,
      events: [],
      positions: {
        homes: [
          {
            purchasePrice: 9_000_000,
            annualAppreciation: 0,
            purchaseMonth: "2026-01",
            downPayment: 1_000_000,
          },
        ],
      },
    };

    const legacyResult = computeProjection(legacyInput);
    const homesResult = computeProjection(homesInput);

    expect(legacyResult.assets.housing).toEqual(homesResult.assets.housing);
    expect(legacyResult.liabilities.mortgage).toEqual(
      homesResult.liabilities.mortgage
    );
  });
});
