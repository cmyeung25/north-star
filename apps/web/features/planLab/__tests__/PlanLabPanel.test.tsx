import React from "react";
(globalThis as { React?: typeof React }).React = React;
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import PlanLabPanel, {
  GROUP_LABEL,
  buildMortgageRateHikeDraftForDecisionTemplate,
  buildMoveHomeDraftForDecisionTemplate,
  buildScenarioItemMetaParts,
  resolveDecisionTemplateBundleTemplateId,
  resolveDecisionTemplateLaunchPath,
  resolvePlanLabMoneyEditHref,
  resolvePlanLabSettingsMembersHref,
} from "../PlanLabPanel";
import type { EventDefinition } from "../../../src/domain/events/types";
import type { Scenario } from "../../../src/store/scenarioStore";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => {
    const translate = ((key: string) => key) as ((key: string) => string) & {
      has: (key: string) => boolean;
    };
    translate.has = () => false;
    return translate;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => undefined,
    replace: () => undefined,
    refresh: () => undefined,
  }),
}));

const scenario: Scenario = {
  id: "scenario-1",
  name: "Base",
  baseCurrency: "USD",
  updatedAt: 1716806400000,
  assumptions: {
    horizonMonths: 24,
    initialCash: 120000,
    baseMonth: "2024-01",
    inflationRate: 2,
  },
  kpis: {
    lowestMonthlyBalance: 100000,
    runwayMonths: 24,
    netWorthYear5: 900000,
    riskLevel: "Medium",
  },
  eventRefs: [{ refId: "event-1", enabled: true, highlighted: false }],
  positions: {
    homes: [],
    cars: [],
    investments: [],
    insurances: [],
    loans: [],
    cashBuckets: [],
  },
};

const eventLibrary: EventDefinition[] = [
  {
    id: "event-1",
    title: "Salary",
    type: "salary",
    kind: "cashflow",
    currency: "USD",
    rule: {
      mode: "params",
      startMonth: "2024-01",
      endMonth: null,
      monthlyAmount: 40000,
      oneTimeAmount: 0,
      annualGrowthPct: 0,
    },
  },
];

const renderPlanLab = (initialMode?: "edit" | "compare") =>
  renderToString(
    <MantineProvider>
      <PlanLabPanel
        scenario={scenario}
        eventLibrary={eventLibrary}
        members={[]}
        budgetRules={[]}
        displayMode="nominal"
        deflateSeries={(series) => series}
        baselineSeries={{
          cash: [],
          netWorth: [],
          netCashflow: [],
        }}
        initialMode={initialMode}
      />
    </MantineProvider>
  );

describe("PlanLabPanel", () => {
  it("PlanLab renders without infinite update loop", () => {
    expect(() => renderPlanLab()).not.toThrow();
  });

  it("PlanLab compare with snapshot renders without infinite loop", () => {
    const html = renderPlanLab("compare");

    expect(html).toContain("Impact KPIs");
    expect(() => renderPlanLab("compare")).not.toThrow();
  });

  it("renders KPI current and baseline values in separate containers", () => {
    const html = renderPlanLab("compare");

    const currentContainerCount = (html.match(/data-testid="kpi-current"/g) ?? []).length;
    const baselineContainerCount = (html.match(/data-testid="kpi-baseline"/g) ?? []).length;

    expect(currentContainerCount > 0).toBe(true);
    expect(baselineContainerCount > 0).toBe(true);
    expect(currentContainerCount).toBe(baselineContainerCount);
  });

  it("maps income/expense group labels to localized text", () => {
    expect(GROUP_LABEL.income).toBe("收入");
    expect(GROUP_LABEL.expense).toBe("支出");
  });


  it("builds deep links from Plan Lab to Money and Settings members", () => {
    expect(
      resolvePlanLabMoneyEditHref({
        caseId: "case-1",
        scenarioId: "scenario-1",
        eventId: "event-1",
        category: "income",
      })
    ).toContain("tab=income&editEventId=event-1");
    expect(
      resolvePlanLabSettingsMembersHref({
        caseId: "case-1",
        scenarioId: "scenario-1",
        eventId: "event-1",
      })
    ).toContain("focusEventId=event-1#members");
  });

  it("builds meta line without undefined/null placeholders", () => {
    const meta = buildScenarioItemMetaParts({
      item: {
        id: "event:salary",
        kind: "event",
        title: "Salary",
        category: "income",
        enabled: true,
        amount: 5000,
        frequency: "monthly",
        startMonth: "2026-02",
        memberName: "家庭",
      },
      currency: "HKD",
      locale: "zh-HK",
      frequencyLabels: {
        monthly: "每月",
        quarterly: "每季",
        yearly: "每年",
        oneOff: "一次性",
        everyNMonths: "每 N 個月",
        schedule: "排程",
      },
      householdLabel: "家庭",
    }).join(" • ");

    expect(meta).toContain("每月");
    expect(meta).toContain("2026-02 起");
    expect(meta).not.toContain("undefined");
    expect(meta).not.toContain("null");
  });

  it("routes decision templates to the expected editor path", () => {
    expect(
      resolveDecisionTemplateLaunchPath({
        templateId: "rental_plan",
        activeRentEventCount: 0,
      })
    ).toBe("rent_create");
    expect(
      resolveDecisionTemplateLaunchPath({
        templateId: "rental_plan",
        activeRentEventCount: 1,
      })
    ).toBe("rent_edit");
    expect(
      resolveDecisionTemplateLaunchPath({
        templateId: "home_purchase",
        activeRentEventCount: 1,
      })
    ).toBe("bundle");
    expect(
      resolveDecisionTemplateLaunchPath({
        templateId: "mortgage_rate_hike",
        activeRentEventCount: 0,
      })
    ).toBe("mortgage_edit");
    expect(
      resolveDecisionTemplateLaunchPath({
        templateId: "move_home",
        activeRentEventCount: 0,
      })
    ).toBe("housing_edit");
  });

  it("prefills mortgage rate hike drafts from the editable baseline mortgage event", () => {
    const draft = buildMortgageRateHikeDraftForDecisionTemplate(
      {
        id: "housing-1",
        type: "housing",
        kind: "mortgage",
        startMonth: "2026-01",
        propertyAssetId: "asset-1",
        mortgageLiabilityId: "loan-1",
        purchasePrice: 8000000,
        mortgageRatePct: 3.2,
        mortgageTermYears: 30,
        mortgagePayment: 25000,
      },
      "aggressive"
    );

    expect(draft).toMatchObject({
      mortgageRatePct: "5.7",
      mortgagePayment: "",
      mortgagePaymentSource: "estimated",
    });
  });

  it("prefills move-home drafts by delaying the existing housing timing only", () => {
    const draft = buildMoveHomeDraftForDecisionTemplate(
      {
        id: "housing-2",
        type: "housing",
        kind: "mortgage",
        startMonth: "2026-01",
        endMonth: "2028-12",
        propertyAssetId: "asset-1",
        mortgageLiabilityId: "loan-1",
        purchasePrice: 9000000,
        mortgageRatePct: 3.5,
        mortgageTermYears: 30,
        mortgagePayment: 28000,
        rental: {
          enabled: true,
          rentMonthly: 18000,
          startMonth: "2026-02",
          endMonth: "2028-11",
          vacancyRatePct: 4,
          rentAnnualGrowthPct: 3,
          rentGrowthMode: "custom",
        },
      },
      "conservative"
    );

    expect(draft).toMatchObject({
      startMonth: "2026-07",
      endMonth: "2029-06",
      rental: {
        enabled: true,
        rentMonthly: "18000",
        startMonth: "2026-08",
        endMonth: "2029-05",
        vacancyRatePct: "4",
        rentAnnualGrowthPct: "3",
        rentGrowthMode: "custom",
      },
    });
  });

  it("fails closed for unknown bundle templates", () => {
    expect(resolveDecisionTemplateBundleTemplateId("home_purchase")).toBe(
      "life_home_purchase"
    );
    expect(resolveDecisionTemplateBundleTemplateId("mortgage_rate_hike")).toBeNull();
    expect(resolveDecisionTemplateBundleTemplateId("move_home")).toBeNull();
  });

});
