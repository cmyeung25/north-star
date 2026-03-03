import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import IncomeEventList from "../IncomeEventList";
import ExpenseEventList from "../ExpenseEventList";
import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import type { LedgerRow } from "../../../engine/scenarioV2Compiler";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const sectionOrder = [
  "money-event-card-section-title-amount",
  "money-event-card-section-meta-tags",
  "money-event-card-section-month-range",
  "money-event-card-section-projection-summary",
  "money-event-card-section-adjustment-summary",
  "money-event-card-section-actions",
];

const expectSectionOrder = (html: string) => {
  const indexes = sectionOrder.map((section) => html.indexOf(section));
  expect(indexes.every((index) => index >= 0)).toBe(true);
  expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
};

describe("Money event lists i18n keys", () => {
  it("uses translation keys for income adjustment summary labels", () => {
    const events: ScenarioEvent[] = [
      {
        id: "income-base",
        type: "cashflow",
        kind: "income",
        cadence: "monthly",
        amount: 1200,
        startMonth: "2024-01",
        label: "Salary",
      },
      {
        id: "income-adjust",
        baseEventId: "income-base",
        type: "cashflow",
        kind: "income",
        cadence: "monthly",
        amount: 1400,
        startMonth: "2024-06",
        label: "Salary raise",
      },
    ];
    const ledgerRowsByEventId = new Map<string, LedgerRow[]>([
      ["income-base", [{ month: "2024-05", amount: 1200, sourceEventId: "income-base", kind: "income" }]],
      ["income-adjust", [{ month: "2024-06", amount: 1400, sourceEventId: "income-adjust", kind: "income" }]],
    ]);

    const html = renderToString(
      <MantineProvider>
        <IncomeEventList
          events={events}
          ledgerRowsByEventId={ledgerRowsByEventId}
          baseCurrency="HKD"
          locale="zh-HK"
          memberLookupRecord={{}}
          sortBy="amountDesc"
          onSortByChange={() => undefined}
          onEditEvent={() => undefined}
          onDuplicateEvent={() => undefined}
          onDeleteEvent={() => undefined}
          onCreateEventAdjustment={() => undefined}
        />
      </MantineProvider>
    );

    expect(html).toContain("eventAdjustmentLatestSummary");
    expect(html).toContain("eventAdjustmentExpand");
    expect(html).not.toContain("新增調整");
    expectSectionOrder(html);
  });

  it("uses translation keys for expense adjustment summary labels", () => {
    const events: ScenarioEvent[] = [
      {
        id: "expense-base",
        type: "cashflow",
        kind: "expense",
        cadence: "monthly",
        amount: 500,
        startMonth: "2024-01",
        label: "Rent",
      },
      {
        id: "expense-adjust",
        baseEventId: "expense-base",
        type: "cashflow",
        kind: "expense",
        cadence: "monthly",
        amount: 550,
        startMonth: "2024-02",
        label: "Rent increase",
      },
    ];
    const ledgerRowsByEventId = new Map<string, LedgerRow[]>([
      ["expense-base", [{ month: "2024-01", amount: -500, sourceEventId: "expense-base", kind: "expense" }]],
      ["expense-adjust", [{ month: "2024-02", amount: -550, sourceEventId: "expense-adjust", kind: "expense" }]],
    ]);

    const html = renderToString(
      <MantineProvider>
        <ExpenseEventList
          events={events}
          ledgerRowsByEventId={ledgerRowsByEventId}
          baseCurrency="HKD"
          locale="zh-HK"
          onEditEvent={() => undefined}
          onDuplicateEvent={() => undefined}
          onDeleteEvent={() => undefined}
          onCreateEventAdjustment={() => undefined}
        />
      </MantineProvider>
    );

    expect(html).toContain("eventAdjustmentLatestSummary");
    expect(html).toContain("eventAdjustmentExpand");
    expect(html).not.toContain("新增調整");
    expectSectionOrder(html);
  });
});
