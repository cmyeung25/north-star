import { describe, expect, it } from "vitest";
import type { ProjectionResult } from "@north-star/engine";
import { selectMonthSnapshot } from "../projectionSelectors";

const projection: ProjectionResult = {
  months: ["2026-01", "2026-02"],
  cashBalance: [1000, 1200],
  netWorth: [5000, 5400],
  assets: { total: [8000, 8600] },
  liabilities: { total: [3000, 3200] },
} as ProjectionResult;

describe("selectMonthSnapshot", () => {
  it("returns monthly snapshot from projection and ledger rows", () => {
    const snapshot = selectMonthSnapshot({
      projection,
      monthKey: "2026-02",
      ledgerByMonth: {
        "2026-02": [{ amount: 600 }, { amount: -250 }],
      },
      positionCashflowsByMonth: {
        "2026-02": [{ amount: -50 }],
      },
    });

    expect(snapshot).toEqual({
      month: "2026-02",
      cashEom: 1200,
      netWorth: 5400,
      netCashflow: 300,
      inflow: 600,
      outflow: 300,
      assetsTotal: 8600,
      liabilitiesTotal: 3200,
    });
  });

  it("returns null when projection is missing or month is out of range", () => {
    expect(selectMonthSnapshot({ projection: null, monthKey: "2026-01" })).toBeNull();
    expect(selectMonthSnapshot({ projection, monthKey: "2030-01" })).toBeNull();
  });
});
