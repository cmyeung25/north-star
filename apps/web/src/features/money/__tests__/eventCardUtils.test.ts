import { describe, expect, it } from "vitest";
import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import type { LedgerRow } from "../../../engine/scenarioV2Compiler";
import {
  filterEventsByLedgerImpact,
  resolveEventCardAmount,
  resolveEventCardEndMonth,
  resolveEventCardStartMonth,
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
});
