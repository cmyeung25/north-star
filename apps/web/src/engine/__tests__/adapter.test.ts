import { describe, expect, it } from "vitest";
import type { ProjectionResult } from "@north-star/engine";
import { mapNetWorthSeries } from "../adapter";

const buildProjection = (
  overrides: Partial<ProjectionResult> = {}
): ProjectionResult => ({
  baseMonth: "2024-01",
  months: ["2024-01", "2024-02"],
  netCashflow: [0, 0],
  cashBalance: [0, 0],
  assets: { housing: [0, 0], investments: [0, 0], insurance: [0, 0], total: [0, 0] },
  liabilities: { mortgage: [0, 0], total: [0, 0] },
  netWorth: [1000, 1500],
  lowestMonthlyBalance: { value: 0, index: 0, month: "2024-01" },
  runwayMonths: 24,
  netWorthYear5: 1500,
  riskLevel: "Low",
  ...overrides,
});

describe("mapNetWorthSeries", () => {
  it("maps projection.netWorth to month/value points", () => {
    const projection = buildProjection();

    expect(mapNetWorthSeries(projection)).toEqual([
      { month: "2024-01", value: 1000 },
      { month: "2024-02", value: 1500 },
    ]);
  });

  it("uses the shortest series length", () => {
    const projection = buildProjection({ netWorth: [500] });

    expect(mapNetWorthSeries(projection)).toEqual([{ month: "2024-01", value: 500 }]);
  });
});
