import { describe, expect, it } from "vitest";
import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import type { LedgerRow } from "../../../engine/scenarioV2Compiler";
import {
  buildIncomeSummary,
  filterIncomeEvents,
  groupIncomeEvents,
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
    category: "salary",
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
    category: "salary",
  },
  {
    id: "income-bonus",
    type: "cashflow",
    kind: "income",
    cadence: "oneOff",
    amount: 50000,
    occurrenceMonth: "2026-06",
    memberId: "gary",
    category: "salary",
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

  it("uses base month ledger rows for baseline monthly income", () => {
    const summary = buildIncomeSummary({
      events: [
        {
          id: "income-step",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 88000,
          startMonth: "2028-02",
          memberId: "gary",
        },
      ],
      ledgerRowsByEventId: new Map([
        [
          "income-step",
          [
            { month: "2028-01", amount: 67000, sourceEventId: "income-step", kind: "income" },
            { month: "2028-02", amount: 88000, sourceEventId: "income-step", kind: "income" },
          ],
        ],
      ]),
      baseMonth: "2028-01",
    });

    expect(summary.baselineMonthlyTotal).toBe(67000);
  });



  it("keeps one-off income events visible in grouped list", () => {
    const grouped = groupIncomeEvents([
      {
        id: "income-13th",
        type: "cashflow",
        kind: "income",
        cadence: "oneOff",
        amount: 130000,
        occurrenceMonth: "2026-12",
        label: "第 13 個月花紅",
      },
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.baseEvent.id).toBe("income-13th");
    expect(grouped[0]?.adjustments).toEqual([]);
  });

  it("groups salary adjustments under parent salary event", () => {
    const grouped = groupIncomeEvents([
      events[0],
      {
        id: "income-adjust",
        type: "cashflow",
        kind: "income",
        cadence: "monthly",
        amount: 8000,
        startMonth: "2027-01",
        tags: ["salary_adjustment", "salary_parent:income-gary"],
      },
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.baseEvent.id).toBe("income-gary");
    expect(grouped[0]?.groupId).toBe("income-gary");
    expect(grouped[0]?.groupStartMonth).toBe("2026-01");
    expect(grouped[0]?.adjustments.map((event) => event.id)).toEqual(["income-adjust"]);
  });

  it("uses grouped metadata when present", () => {
    const grouped = groupIncomeEvents([
      {
        ...events[0],
        id: "income-gary",
        groupId: "income-gary",
        groupRole: "base",
      },
      {
        id: "income-gary::adj::2028-02",
        type: "cashflow",
        kind: "income",
        cadence: "monthly",
        amount: 80000,
        startMonth: "2028-02",
        groupId: "income-gary",
        groupRole: "adjustment",
        parentEventId: "income-gary",
      },
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.groupId).toBe("income-gary");
    expect(grouped[0]?.adjustments[0]?.id).toBe("income-gary::adj::2028-02");
  });

  it("aggregates income summary by category", () => {
    const summary = buildIncomeSummary({
      events: [
        events[0],
        {
          id: "income-adjust",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 80000,
          startMonth: "2028-02",
          tags: ["salary_adjustment", "salary_parent:income-gary"],
          category: "salary",
        },
      ],
      ledgerRowsByEventId: new Map(),
    });

    expect(summary.sourceCount).toBe(1);
    expect(summary.topSources).toHaveLength(1);
    expect(summary.topSources[0]?.id).toBe("salary");
    expect(summary.topSources[0]?.amount).toBe(110000);
  });

});
