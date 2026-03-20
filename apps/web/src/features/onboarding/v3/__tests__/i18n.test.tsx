import React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import { MantineProvider } from "@mantine/core";
import enMessages from "../../../../../messages/en.json";
import zhHkMessages from "../../../../../messages/zh-HK.json";
import AssetsStep from "../steps/AssetsStep";
import ReviewStep from "../steps/ReviewStep";
import {
  buildOnboardingCompletenessSummary,
  type OnboardingCompletenessGroupStatus,
} from "../completeness";
import { createInitialScenarioDraftV3State } from "../types";

type OnboardingCompletenessMessages = {
  onboardingV3: {
    completeness: {
      groups: Record<
        string,
        {
          title: string;
          summary: Record<OnboardingCompletenessGroupStatus, string>;
        }
      >;
    };
  };
};

const resolveCompletenessMessage = (
  messages: OnboardingCompletenessMessages,
  key: string,
  status: OnboardingCompletenessGroupStatus
) => ({
  title: messages.onboardingV3.completeness.groups[key]?.title,
  summary: messages.onboardingV3.completeness.groups[key]?.summary[status],
});

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

  it("provides localized completeness labels for review consumers", () => {
    const draft = createInitialScenarioDraftV3State({ defaultMemberName: "Me" });
    draft.profile.startMonth = "2026-03";
    draft.events.push({
      id: "auto-salary",
      type: "cashflow",
      kind: "income",
      label: "Salary",
      amount: 20000,
      cadence: "monthly",
      startMonth: "2026-03",
      tags: ["onboarding:v3:income:salary:auto"],
    });

    const summary = buildOnboardingCompletenessSummary({ draft });

    const enHtml = renderToString(
      <MantineProvider>
        <NextIntlClientProvider locale="en" messages={enMessages as unknown as AbstractIntlMessages} timeZone="UTC">
          <span>
            {summary.groups.map((group) => (
              <span key={group.key}>
                {resolveCompletenessMessage(
                  enMessages as unknown as OnboardingCompletenessMessages,
                  group.key,
                  group.status
                ).title}
                {resolveCompletenessMessage(
                  enMessages as unknown as OnboardingCompletenessMessages,
                  group.key,
                  group.status
                ).summary}
              </span>
            ))}
          </span>
        </NextIntlClientProvider>
      </MantineProvider>
    );

    const zhHtml = renderToString(
      <MantineProvider>
        <NextIntlClientProvider locale="zh-HK" messages={zhHkMessages as unknown as AbstractIntlMessages} timeZone="UTC">
          <span>
            {summary.groups.map((group) => (
              <span key={group.key}>
                {resolveCompletenessMessage(
                  zhHkMessages as unknown as OnboardingCompletenessMessages,
                  group.key,
                  group.status
                ).title}
                {resolveCompletenessMessage(
                  zhHkMessages as unknown as OnboardingCompletenessMessages,
                  group.key,
                  group.status
                ).summary}
              </span>
            ))}
          </span>
        </NextIntlClientProvider>
      </MantineProvider>
    );

    expect(enHtml).toContain("Household structure");
    expect(enHtml).toContain("Only suggested or non-recurring income is available so far.");
    expect(zhHtml).toContain("家庭結構");
    expect(zhHtml).toContain("目前只有建議值或非固定收入，仍需確認。");
  });

  it("renders localized housing/property IA copy in the assets step", () => {
    const noop = () => {};

    const enHtml = renderToString(
      <MantineProvider>
        <NextIntlClientProvider locale="en" messages={enMessages as unknown as AbstractIntlMessages} timeZone="UTC">
          <AssetsStep
            assets={[]}
            startMonth="2026-03"
            baseCurrency="HKD"
            assetToggles={{ propertyEnabled: true, investmentEnabled: false }}
            onAssetsChange={noop}
            onAssetTogglesChange={noop}
          />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    const zhHtml = renderToString(
      <MantineProvider>
        <NextIntlClientProvider locale="zh-HK" messages={zhHkMessages as unknown as AbstractIntlMessages} timeZone="UTC">
          <AssetsStep
            assets={[]}
            startMonth="2026-03"
            baseCurrency="HKD"
            assetToggles={{ propertyEnabled: true, investmentEnabled: false }}
            onAssetsChange={noop}
            onAssetTogglesChange={noop}
          />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    expect(enHtml).toContain("First decide: are you filling current rent or owned property?");
    expect(enHtml).toContain("Self-use property");
    expect(zhHtml).toContain("先分清：你現在是填租屋，還是填已持有物業？");
    expect(zhHtml).toContain("自住物業");
  });
});
