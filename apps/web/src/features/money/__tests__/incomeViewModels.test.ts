import { describe, expect, it } from "vitest";
import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import type { LedgerRow } from "../../../engine/scenarioV2Compiler";
import {
  buildIncomeSummary,
  filterIncomeEvents,
  sortIncomeEvents,
} from "../incomeViewModels";

const events: ScenarioEvent[] = [
  {
    id: "income-gary",
    type: "cashflow",
    kind: "income",
    cadence: "monthly",
    amount: 30000,
    startMonth: "2026-01",
    memberId: "gary",
  },
  {
    id: "income-mimi",
    type: "cashflow",
    kind: "income",
    cadence: "monthly",
    amount: 20000,
    startMonth: "2026-01",
    endMonth: "2026-11",
    memberId: "mimi",
  },
  {
    id: "income-bonus",
    type: "cashflow",
    kind: "income",
    cadence: "oneOff",
    amount: 50000,
    occurrenceMonth: "2026-06",
    memberId: "gary",
  },
];

describe("incomeViewModels", () => {
  it("filters by member and ending status", () => {
    expect(filterIncomeEvents(events, "gary", "all").map((event) => event.id)).toEqual([
      "income-gary",
      "income-bonus",
    ]);
    expect(filterIncomeEvents(events, "all", "ending").map((event) => event.id)).toEqual([
      "income-mimi",
      "income-bonus",
    ]);
  });

  it("sorts by baseline amount descending by default", () => {
    expect(sortIncomeEvents(events, "amountDesc").map((event) => event.id)).toEqual([
      "income-bonus",
      "income-gary",
      "income-mimi",
    ]);
  });

  it("builds summary with monthly/non-monthly split and projection delta", () => {
    const rows = new Map<string, LedgerRow[]>();
    rows.set("income-gary", [
      { month: "2026-01", amount: 30000, sourceEventId: "income-gary", kind: "income" },
      { month: "2026-12", amount: 33000, sourceEventId: "income-gary", kind: "income" },
    ]);
    rows.set("income-mimi", [
      { month: "2026-01", amount: 20000, sourceEventId: "income-mimi", kind: "income" },
      { month: "2026-12", amount: 0, sourceEventId: "income-mimi", kind: "income" },
    ]);

    const summary = buildIncomeSummary({
      events,
      ledgerRowsByEventId: rows,
      baseMonth: "2026-01",
    });

    expect(summary.baselineMonthlyTotal).toBe(50000);
    expect(summary.nonMonthlyIncomeTotal).toBe(50000);
    expect(summary.projectedDelta12m).toBe(-17000);
    expect(summary.expiringCount).toBe(2);
  });
});
