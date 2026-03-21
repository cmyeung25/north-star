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
import { buildOnboardingGuardrailSummary } from "../guardrails";
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

type OnboardingGuardrailRuleMessages = {
  onboardingV3: {
    guardrails: {
      rules: Record<
        (typeof targetGuardrailKeys)[number],
        {
          message: string;
          action: string;
        }
      >;
    };
  };
};

type OnboardingReviewMessages = {
  onboardingV3: {
    steps: {
      review: {
        guardrailSections: Record<
          "critical" | "warning" | "info",
          {
            title: string;
            description: string;
            empty: string;
          }
        >;
      };
    };
  };
};

const extractPlaceholders = (value: string) =>
  Array.from(value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)).map((match) => match[1]).sort();

const resolveCompletenessMessage = (
  messages: OnboardingCompletenessMessages,
  key: string,
  status: OnboardingCompletenessGroupStatus
) => ({
  title: messages.onboardingV3.completeness.groups[key]?.title,
  summary: messages.onboardingV3.completeness.groups[key]?.summary[status],
});

const targetGuardrailKeys = [
  "propertyUsageMissing",
  "mortgageCoreFieldsMissing",
  "selfUseRentalConflict",
  "rentalPropertyIncomeMissing",
  "mortgagePropertyBasicsMissing",
  "duplicateCurrentHomeHousingCosts",
  "duplicateRentExpenseInputs",
] as const;

describe("onboarding v3 i18n", () => {
  it("injects locale-specific default member name during initial draft creation", () => {
    const enDraft = createInitialScenarioDraftV3State({ defaultMemberName: "Me" });
    const zhDraft = createInitialScenarioDraftV3State({ defaultMemberName: "本人" });

    expect(enDraft.members[0]?.name).toBe("Me");
    expect(zhDraft.members[0]?.name).toBe("本人");

    expect(/^\d{4}-\d{2}$/.test(enDraft.profile.startMonth ?? "")).toBe(true);
  });

  it("renders review labels based on locale messages", () => {
    const draft = createInitialScenarioDraftV3State({ defaultMemberName: "Me" });
    draft.profile.startMonth = "2026-01";
    draft.profile.baseCurrency = "HKD";
    draft.assets.push({
      id: "property-1",
      assetType: "property",
      kind: "home",
      label: "Home",
      currentValue: 7_500_000,
      startMonth: "2026-01",
      mortgagePrincipalOutstanding: 3_000_000,
    });
    const summary = {
      scenarioSetup: { baseCurrency: "HKD", startMonth: "2026-01", horizonMonths: 120 },
      members: [{ id: "self", name: "Me" }],
      assets: draft.assets,
      derivedIncomeCount: 1,
      derivedExpenseCount: 1,
      manualIncomeCount: 0,
      manualExpenseCount: 0,
      totalAssetsAmount: 0,
      monthlyIncomeAmount: 0,
      monthlyExpenseAmount: 0,
    };
    const completenessSummary = buildOnboardingCompletenessSummary({ draft });
    const guardrailSummary = buildOnboardingGuardrailSummary({ draft });

    const enHtml = renderToString(
      <MantineProvider>
        <NextIntlClientProvider locale="en" messages={enMessages as unknown as AbstractIntlMessages} timeZone="UTC">
          <ReviewStep
            summary={summary}
            completenessSummary={completenessSummary}
            guardrailSummary={guardrailSummary}
            onEditStep={() => {}}
            onEditCompletenessGroup={() => {}}
            onFixGuardrail={() => {}}
          />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    const zhHtml = renderToString(
      <MantineProvider>
        <NextIntlClientProvider locale="zh-HK" messages={zhHkMessages as unknown as AbstractIntlMessages} timeZone="UTC">
          <ReviewStep
            summary={summary}
            completenessSummary={completenessSummary}
            guardrailSummary={guardrailSummary}
            onEditStep={() => {}}
            onEditCompletenessGroup={() => {}}
            onFixGuardrail={() => {}}
          />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    expect(enHtml).toContain("Summary before submit");
    expect(enHtml).toContain("Guardrails to review");
    expect(enHtml).toContain("Critical / must fix");
    expect(enHtml).toContain("Warning / review recommended");
    expect(enHtml).toContain("Info / heads-up");
    expect(enHtml).toContain("Returns you to Assets → Mortgage details.");
    expect(enHtml).toContain("Go to Assets");
    expect(zhHtml).toContain("提交前摘要");
    expect(zhHtml).toContain("提交前風險提示");
    expect(zhHtml).toContain("Critical / 必須修正");
    expect(zhHtml).toContain("Warning / 建議再檢查");
    expect(zhHtml).toContain("Info / 提交前提醒");
    expect(zhHtml).toContain("按下後會帶你返回 資產 → 按揭資料。");
    expect(zhHtml).toContain("返回 資產");
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

  it("keeps the rewritten guardrail copy aligned across en and zh-HK", () => {
    const enRules = (enMessages as unknown as OnboardingGuardrailRuleMessages).onboardingV3.guardrails.rules;
    const zhRules = (zhHkMessages as unknown as OnboardingGuardrailRuleMessages).onboardingV3.guardrails.rules;
    const enReviewSections = (enMessages as unknown as OnboardingReviewMessages).onboardingV3.steps.review.guardrailSections;
    const zhReviewSections = (zhHkMessages as unknown as OnboardingReviewMessages).onboardingV3.steps.review.guardrailSections;

    for (const key of targetGuardrailKeys) {
      const enRule = enRules[key];
      const zhRule = zhRules[key];

      expect(enRule.message, `missing en message for ${key}`).toBeTruthy();
      expect(enRule.action, `missing en action for ${key}`).toBeTruthy();
      expect(zhRule.message, `missing zh-HK message for ${key}`).toBeTruthy();
      expect(zhRule.action, `missing zh-HK action for ${key}`).toBeTruthy();

      expect(/baseline|loan|mortgage|cashflow|cost/i.test(enRule.message)).toBe(true);
      expect(/Assets|Expenses/.test(enRule.action)).toBe(true);
      expect(/baseline|現金流|供款|成本|租金|按揭/.test(zhRule.message)).toBe(true);
      expect(/資產|支出/.test(zhRule.action)).toBe(true);
      expect(extractPlaceholders(zhRule.message)).toEqual(extractPlaceholders(enRule.message));
      expect(extractPlaceholders(zhRule.action)).toEqual(extractPlaceholders(enRule.action));
      expect(/�|\?{3,}|資料錯誤/.test(zhRule.message)).toBe(false);
      expect(/�|\?{3,}|資料錯誤/.test(zhRule.action)).toBe(false);
    }

    for (const severity of ["critical", "warning", "info"] as const) {
      expect(enReviewSections[severity].title).toBeTruthy();
      expect(enReviewSections[severity].description).toBeTruthy();
      expect(enReviewSections[severity].empty).toBeTruthy();
      expect(zhReviewSections[severity].title).toBeTruthy();
      expect(zhReviewSections[severity].description).toBeTruthy();
      expect(zhReviewSections[severity].empty).toBeTruthy();
      expect(extractPlaceholders(zhReviewSections[severity].description)).toEqual(
        extractPlaceholders(enReviewSections[severity].description)
      );
    }

    expect(enRules.propertyUsageMissing.message).toContain("current-home path");
    expect(enRules.mortgagePropertyBasicsMissing.action).toContain("open the home that carries this mortgage");
    expect(enRules.duplicateCurrentHomeHousingCosts.message).toContain("current-home costs");
    expect(enRules.duplicateCurrentHomeHousingCosts.action).toContain("remove the self-use owner-home setup");
    expect(enRules.duplicateRentExpenseInputs.action).toContain("overlapping rent rows for your current home");
    expect(zhRules.propertyUsageMissing.message).toContain("現居路徑");
    expect(zhRules.mortgagePropertyBasicsMissing.action).toContain("承載呢筆按揭嘅物業");
    expect(zhRules.duplicateCurrentHomeHousingCosts.message).toContain("兩個地方出現");
    expect(zhRules.duplicateCurrentHomeHousingCosts.action).toContain("移除自住房設定");
    expect(zhRules.duplicateRentExpenseInputs.action).toContain("屬於現居嘅重疊租金項目");
  });
});
