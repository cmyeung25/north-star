import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import MoneyLedgerView from "../MoneyLedgerView";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (values?.month) {
      return `${key}-${values.month}`;
    }
    return key;
  },
}));

describe("MoneyLedgerView", () => {
  it("renders ledger rows for v2 scenarios", () => {
    const html = renderToString(
      React.createElement(
        MantineProvider,
        null,
        React.createElement(MoneyLedgerView, {
          rows: [
            {
              month: "2024-03",
              amount: 1200,
              sourceEventId: "evt-1",
              label: "Salary",
              kind: "income",
            },
          ],
          baseCurrency: "USD",
          locale: "en",
          members: [],
          onEditEvent: () => undefined,
          onDuplicateEvent: () => undefined,
          onDeleteEvent: () => undefined,
          onAdjustEvent: () => undefined,
        })
      )
    );

    expect(html).toContain("Salary");
    expect(html).toContain("ledgerRowMeta-2024-03");
  });
});
