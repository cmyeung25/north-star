import { describe, expect, it } from "vitest";
import type { ProjectionResult } from "@north-star/engine";
import { selectMonthSnapshot } from "../projectionSelectors";

const projection: ProjectionResult = {
  baseMonth: "2026-01",
  months: ["2026-01", "2026-02"],
  cashBalance: [1000, 1200],
  netCashflow: [100, 200],
  netWorth: [5000, 5400],
  assets: {
    housing: [0, 0],
    cars: [0, 0],
    investments: [0, 0],
    insurance: [0, 0],
    total: [8000, 8600],
  },
  liabilities: {
    mortgage: [0, 0],
    loans: [0, 0],
    auto: [0, 0],
    total: [3000, 3200],
  },
  lowestMonthlyBalance: { value: 1000, index: 0, month: "2026-01" },
  runwayMonths: 24,
  netWorthYear5: 120000,
  riskLevel: "Low",
  breakdown: {
    cashflow: {
      months: ["2026-01", "2026-02"],
      byKey: {
        salary: [500, 800],
        rent: [-300, -450],
        groceries: [-100, -150],
      },
      totals: [100, 200],
    },
    assets: {
      months: ["2026-01", "2026-02"],
      assetsByKey: {},
      liabilitiesByKey: {},
    },
  },
} as ProjectionResult;

describe("selectMonthSnapshot", () => {
  it("prefers projection-native summary values even when ledger breakdown diverges", () => {
    const snapshot = selectMonthSnapshot({
      projection,
      monthKey: "2026-02",
      ledgerByMonth: {
        "2026-02": [{ amount: 600 }, { amount: -250 }, { amount: -100 }],
      },
      positionCashflowsByMonth: {
        "2026-02": [{ amount: -50 }],
      },
    });

    expect(snapshot).toEqual({
      month: "2026-02",
      cashEom: 1200,
      netWorth: 5400,
      netCashflow: 200,
      inflow: 800,
      outflow: 600,
      assetsTotal: 8600,
      liabilitiesTotal: 3200,
    });
  });

  it("keeps month card metrics internally consistent when using projection source", () => {
    const snapshot = selectMonthSnapshot({
      projection,
      monthKey: "2026-02",
      ledgerByMonth: {
        "2026-02": [{ amount: 100 }, { amount: -10 }],
      },
      positionCashflowsByMonth: {
        "2026-02": [{ amount: -20 }],
      },
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.netCashflow).toBe(snapshot!.inflow - snapshot!.outflow);
    expect(snapshot?.netCashflow).toBe(200);
  });

  it("falls back to ledger net cashflow when projection netCashflow series is unavailable", () => {
    const snapshot = selectMonthSnapshot({
      projection: {
        ...projection,
        netCashflow: [],
      } as ProjectionResult,
      monthKey: "2026-02",
      ledgerByMonth: {
        "2026-02": [{ amount: 500 }, { amount: -100 }],
      },
      positionCashflowsByMonth: {
        "2026-02": [{ amount: -25 }],
      },
    });

    expect(snapshot).toEqual({
      month: "2026-02",
      cashEom: 1200,
      netWorth: 5400,
      netCashflow: 375,
      inflow: 500,
      outflow: 125,
      assetsTotal: 8600,
      liabilitiesTotal: 3200,
    });
  });

  it("returns null when projection is missing or month is out of range", () => {
    expect(selectMonthSnapshot({ projection: null, monthKey: "2026-01" })).toBeNull();
    expect(selectMonthSnapshot({ projection, monthKey: "2030-01" })).toBeNull();
  });
});
