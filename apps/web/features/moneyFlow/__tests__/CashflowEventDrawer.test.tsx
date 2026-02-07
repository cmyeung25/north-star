import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import CashflowEventDrawer from "../CashflowEventDrawer";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("CashflowEventDrawer", () => {
  it("renders month-of-year selector for yearly cadence", () => {
    const html = renderToString(
      React.createElement(
        MantineProvider,
        null,
        React.createElement(CashflowEventDrawer, {
          opened: true,
          mode: "edit",
          baseCurrency: "USD",
          scenarioStartMonth: "2024-06",
          members: [],
          event: {
            id: "evt-yearly",
            type: "cashflow",
            kind: "income",
            cadence: "yearly",
            amount: 1200,
            startMonth: "2024-07",
          },
          onClose: () => undefined,
          onSave: () => undefined,
        })
      )
    );

    expect(html).toContain("ledgerEventStartMonth");
  });
});
