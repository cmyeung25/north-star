import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import CashflowEventDrawer from "../CashflowEventDrawer";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (key === "ledgerEventGrowthModeAssumption") {
      return `跟隨假設（${values?.pct}%）`;
    }
    if (key === "ledgerEventGrowthModeAssumptionUnset") {
      return "跟隨假設（未設定）";
    }
    return key;
  },
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

    expect(html).toContain("ledgerEventYearlyMonth");
  });

  it("shows follow-assumption copy with income growth percentage", () => {
    const html = renderToString(
      React.createElement(
        MantineProvider,
        null,
        React.createElement(CashflowEventDrawer, {
          opened: true,
          mode: "create",
          baseCurrency: "USD",
          scenarioStartMonth: "2024-06",
          incomeGrowthPct: 3,
          members: [],
          defaultKind: "income",
          event: null,
          onClose: () => undefined,
          onSave: () => undefined,
        })
      )
    );

    expect(html).toContain("跟隨假設（3%）");
    expect(html).not.toContain("跟隨假設（未設定）");
  });

  it("shows unset follow-assumption copy only when income growth is null", () => {
    const html = renderToString(
      React.createElement(
        MantineProvider,
        null,
        React.createElement(CashflowEventDrawer, {
          opened: true,
          mode: "create",
          baseCurrency: "USD",
          scenarioStartMonth: "2024-06",
          incomeGrowthPct: null,
          members: [],
          defaultKind: "income",
          event: null,
          onClose: () => undefined,
          onSave: () => undefined,
        })
      )
    );

    expect(html).toContain("跟隨假設（未設定）");
  });

  it("uses same growth copy and default behavior for salary template and general income", () => {
    const salaryTemplateHtml = renderToString(
      React.createElement(
        MantineProvider,
        null,
        React.createElement(CashflowEventDrawer, {
          opened: true,
          mode: "create",
          baseCurrency: "USD",
          scenarioStartMonth: "2024-06",
          incomeGrowthPct: 3,
          members: [],
          defaultKind: "income",
          initialCashflowDraft: {
            category: "salary",
          },
          event: null,
          onClose: () => undefined,
          onSave: () => undefined,
        })
      )
    );

    const generalIncomeHtml = renderToString(
      React.createElement(
        MantineProvider,
        null,
        React.createElement(CashflowEventDrawer, {
          opened: true,
          mode: "create",
          baseCurrency: "USD",
          scenarioStartMonth: "2024-06",
          incomeGrowthPct: 3,
          members: [],
          defaultKind: "income",
          initialCashflowDraft: {
            category: "bonus",
          },
          event: null,
          onClose: () => undefined,
          onSave: () => undefined,
        })
      )
    );

    expect(salaryTemplateHtml).toContain("跟隨假設（3%）");
    expect(generalIncomeHtml).toContain("跟隨假設（3%）");
    expect(salaryTemplateHtml).toContain('value="assumption"');
    expect(generalIncomeHtml).toContain('value="assumption"');
  });
});
