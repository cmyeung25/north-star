import React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import { MantineProvider } from "@mantine/core";
import enMessages from "../../../../../messages/en.json";
import zhHkMessages from "../../../../../messages/zh-HK.json";
import ReviewStep from "../steps/ReviewStep";
import { createInitialScenarioDraftV3State } from "../types";

describe("onboarding v3 i18n", () => {
  it("injects locale-specific default member name during initial draft creation", () => {
    const enDraft = createInitialScenarioDraftV3State({ defaultMemberName: "Me" });
    const zhDraft = createInitialScenarioDraftV3State({ defaultMemberName: "本人" });

    expect(enDraft.members[0]?.name).toBe("Me");
    expect(zhDraft.members[0]?.name).toBe("本人");

    expect(/^\d{4}-\d{2}$/.test(enDraft.profile.startMonth ?? "")).toBe(true);
  });

  it("renders review labels based on locale messages", () => {
    const items = [{ label: "Checklist item", completed: true }];
    const summary = {
      scenarioSetup: { baseCurrency: "HKD", startMonth: "2026-01", horizonMonths: 120 },
      members: [{ id: "self", name: "Me" }],
      assets: [],
      derivedIncomeCount: 1,
      derivedExpenseCount: 1,
      manualIncomeCount: 0,
      manualExpenseCount: 0,
      totalAssetsAmount: 0,
      monthlyIncomeAmount: 0,
      monthlyExpenseAmount: 0,
    };

    const enHtml = renderToString(
      <MantineProvider>
        <NextIntlClientProvider locale="en" messages={enMessages as unknown as AbstractIntlMessages} timeZone="UTC">
          <ReviewStep items={items} summary={summary} onEditStep={() => {}} />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    const zhHtml = renderToString(
      <MantineProvider>
        <NextIntlClientProvider locale="zh-HK" messages={zhHkMessages as unknown as AbstractIntlMessages} timeZone="UTC">
          <ReviewStep items={items} summary={summary} onEditStep={() => {}} />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    expect(enHtml).toContain("Summary before submit");
    expect(zhHtml).toContain("提交前摘要");
  });
});
