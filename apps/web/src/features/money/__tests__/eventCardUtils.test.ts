import { describe, expect, it } from "vitest";
import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import type { LedgerRow } from "../../../engine/scenarioV2Compiler";
import {
  filterEventsByLedgerImpact,
  resolveEventMonthlyImpact,
  resolveEventCardAmount,
  resolveEventCardEndMonth,
  resolveEventCardStartMonth,
  resolveProjectionPreviewRow,
  resolveDisplayMonths,
  resolveAdjustmentSummary,
} from "../eventCardUtils";

describe("eventCardUtils", () => {
  it("filters events by ledger impact using sourceEventId", () => {
    const events: ScenarioEvent[] = [
      {
        id: "evt-income",
        type: "cashflow",
        kind: "income",
        cadence: "monthly",
        amount: 500,
        startMonth: "2024-01",
      },
      {
        id: "evt-expense",
        type: "cashflow",
        kind: "expense",
        cadence: "monthly",
        amount: 200,
        startMonth: "2024-01",
      },
    ];
    const ledgerRowsByEventId = new Map<string, LedgerRow[]>();
    ledgerRowsByEventId.set("evt-income", [
      {
        month: "2024-01",
        amount: 500,
        sourceEventId: "evt-income",
        kind: "income",
      },
    ]);
    ledgerRowsByEventId.set("evt-expense", [
      {
        month: "2024-01",
        amount: -200,
        sourceEventId: "evt-expense",
        kind: "expense",
      },
    ]);

    const incomeEvents = filterEventsByLedgerImpact(
      events,
      ledgerRowsByEventId,
      "income"
    );
    const expenseEvents = filterEventsByLedgerImpact(
      events,
      ledgerRowsByEventId,
      "expense"
    );

    expect(incomeEvents.map((event) => event.id)).toEqual(["evt-income"]);
    expect(expenseEvents.map((event) => event.id)).toEqual(["evt-expense"]);
  });

  it("maps event card details for cashflow events", () => {
    const event: ScenarioEvent = {
      id: "evt-cashflow",
      type: "cashflow",
      kind: "income",
      cadence: "oneOff",
      amount: 1200,
      occurrenceMonth: "2024-03",
    };

    expect(resolveEventCardAmount(event)).toBe(1200);
    expect(resolveEventCardStartMonth(event)).toBe("2024-03");
    expect(resolveEventCardEndMonth(event)).toBe("2024-03");
  });

  it("resolves monthly impact at anchor month instead of future month", () => {
    const rows: LedgerRow[] = [
      { month: "2026-01", amount: -1000, sourceEventId: "evt", kind: "expense" },
      { month: "2026-06", amount: -1200, sourceEventId: "evt", kind: "expense" },
      { month: "2027-01", amount: -1500, sourceEventId: "evt", kind: "expense" },
    ];

    const impact = resolveEventMonthlyImpact(rows, "2026-06");

    expect(impact).toEqual({
      income: 0,
      expense: 1200,
      net: -1200,
      month: "2026-06",
    });
  });
  it("resolves projection preview row using anchor month", () => {
    const rows: LedgerRow[] = [
      { month: "2026-01", amount: -1000, sourceEventId: "evt", kind: "expense" },
      { month: "2026-06", amount: -1200, sourceEventId: "evt", kind: "expense" },
      { month: "2027-01", amount: -1500, sourceEventId: "evt", kind: "expense" },
    ];

    const row = resolveProjectionPreviewRow(rows, "2026-06");

    expect(row?.month).toBe("2026-06");
  });

  it("prefers grouped months when adjustments are present", () => {
    expect(
      resolveDisplayMonths({
        startMonth: "2024-01",
        endMonth: "2024-12",
        groupStartMonth: "2024-02",
        groupEndMonth: "2024-11",
        hasAdjustments: true,
      })
    ).toEqual({ startMonth: "2024-02", endMonth: "2024-11" });
  });

  it("builds latest adjustment summary from adjustment list", () => {
    const adjustments: ScenarioEvent[] = [
      {
        id: "adj-1",
        baseEventId: "base",
        type: "cashflow",
        kind: "income",
        cadence: "monthly",
        amount: 1000,
        startMonth: "2024-01",
      },
      {
        id: "adj-2",
        baseEventId: "base",
        type: "cashflow",
        kind: "income",
        cadence: "monthly",
        amount: 1200,
        startMonth: "2024-02",
      },
    ];

    expect(resolveAdjustmentSummary({ adjustments, resolveAmount: (event) => event.type === "cashflow" ? event.amount : 0 })).toEqual({
      count: 2,
      month: "2024-02",
      amount: 1200,
    });
  });

});
