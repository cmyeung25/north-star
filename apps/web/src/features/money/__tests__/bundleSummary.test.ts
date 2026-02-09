import { describe, expect, it } from "vitest";
import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import type { LedgerRow } from "../../../engine/scenarioV2Compiler";
import { computeBundleMonthlySummary } from "../bundleSummary";

describe("computeBundleMonthlySummary", () => {
  it("separates one-off cashflows from monthly recurring totals", () => {
    const events: ScenarioEvent[] = [
      {
        id: "income-monthly",
        type: "cashflow",
        kind: "income",
        cadence: "monthly",
        amount: 5000,
        startMonth: "2026-02",
      },
      {
        id: "expense-oneoff",
        type: "cashflow",
        kind: "expense",
        cadence: "oneOff",
        amount: 200000,
        occurrenceMonth: "2026-02",
      },
      {
        id: "housing-mortgage",
        type: "housing",
        kind: "mortgage",
        startMonth: "2026-02",
        mortgageRatePct: 3,
        mortgageTermYears: 30,
        purchasePrice: 5000000,
        mortgagePayment: 20000,
        feesOneOff: [
          {
            id: "fee-stamp-duty",
            label: "Stamp duty",
            amount: 60000,
            month: "2026-02",
          },
        ],
        ongoingCosts: [
          {
            id: "fee-management",
            label: "Management fee",
            amount: 1500,
            startMonth: "2026-02",
          },
        ],
      },
    ];

    const ledgerRowsByEventId = new Map<string, LedgerRow[]>();
    ledgerRowsByEventId.set("income-monthly", [
      {
        month: "2026-02",
        amount: 5000,
        sourceEventId: "income-monthly",
        kind: "income",
      },
    ]);
    ledgerRowsByEventId.set("expense-oneoff", [
      {
        month: "2026-02",
        amount: -200000,
        sourceEventId: "expense-oneoff",
        kind: "expense",
      },
    ]);
    ledgerRowsByEventId.set("housing-mortgage", [
      {
        month: "2026-02",
        amount: -20000,
        sourceEventId: "housing-mortgage",
        label: "Mortgage payment",
        kind: "expense",
        linkedLiabilityId: "mortgage-liability",
      },
      {
        month: "2026-02",
        amount: -60000,
        sourceEventId: "housing-mortgage",
        label: "Stamp duty",
        kind: "expense",
      },
      {
        month: "2026-02",
        amount: -1500,
        sourceEventId: "housing-mortgage",
        label: "Management fee",
        kind: "expense",
      },
    ]);

    const summary = computeBundleMonthlySummary(
      events,
      ledgerRowsByEventId,
      "2026-02",
      {
        mortgagePayment: "Mortgage payment",
        rentalIncome: "Rental income",
        holdingCost: "Holding cost",
        fallback: "Cashflow",
      }
    );

    expect(summary.monthlyIncome).toBe(5000);
    expect(summary.monthlyExpense).toBe(21500);
    expect(summary.monthlyNet).toBe(-16500);
    expect(summary.startMonthOneOffExpense).toBe(260000);
    expect(summary.startMonthNet).toBe(-276500);
    expect(summary.oneOffBreakdown.map((item) => item.label)).toEqual([
      "Cashflow",
      "Stamp duty",
    ]);
  });
});
