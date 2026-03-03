import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import EventCardList from "../EventCardList";
import MoneyEventCard from "../MoneyEventCard";
import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import type { LedgerRow } from "../../../engine/scenarioV2Compiler";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("EventCardList", () => {
  it("renders event cards with ledger impact toggle", () => {
    const events: ScenarioEvent[] = [
      {
        id: "evt-income",
        type: "cashflow",
        kind: "income",
        cadence: "monthly",
        amount: 500,
        startMonth: "2024-01",
        label: "Salary",
      },
    ];
    const ledgerRowsByEventId = new Map<string, LedgerRow[]>([
      [
        "evt-income",
        [
          {
            month: "2024-01",
            amount: 500,
            sourceEventId: "evt-income",
            kind: "income",
          },
        ],
      ],
    ]);

    const html = renderToString(
      React.createElement(
        MantineProvider,
        null,
        React.createElement(EventCardList, {
          events,
          ledgerRowsByEventId,
          baseCurrency: "USD",
          locale: "en",
          onEditEvent: () => undefined,
          onDuplicateEvent: () => undefined,
          onDeleteEvent: () => undefined,
          onAdjustEvent: () => undefined,
        })
      )
    );

    expect(html).toContain("Salary");
    expect(html).toContain("eventCardExpandLedger");
  });

  it("renders shared money card sections in fixed order", () => {
    const html = renderToString(
      <MantineProvider>
        <MoneyEventCard
          title="Salary"
          primaryAmount="$1000"
          metaTags={<div>meta</div>}
          monthRange={<div>months</div>}
          projectionSummary={<div>projection</div>}
          adjustmentSummary={<div>adjustments</div>}
          actions={<div>actions</div>}
        />
      </MantineProvider>
    );

    const sectionOrder = [
      "money-event-card-section-title-amount",
      "money-event-card-section-meta-tags",
      "money-event-card-section-month-range",
      "money-event-card-section-projection-summary",
      "money-event-card-section-adjustment-summary",
      "money-event-card-section-actions",
    ];

    const indexes = sectionOrder.map((section) => html.indexOf(section));
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });
});
