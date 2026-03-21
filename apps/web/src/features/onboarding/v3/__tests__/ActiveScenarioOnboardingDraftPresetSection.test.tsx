import fs from "node:fs";
import path from "node:path";
import React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import enMessages from "../../../../../messages/en.json";
import zhHkMessages from "../../../../../messages/zh-HK.json";
import {
  createScenarioSeedTranslatorFromMessages,
  getScenarioSeeds,
} from "../../../../scenarios/scenarioSeeds";
import { MEMBER_CASE_PRESET_SEED_IDS } from "../../seedPrefill";
import ActiveScenarioOnboardingDraftPresetSection, {
  shouldShowActiveScenarioOnboardingDraftPresetSection,
} from "../ActiveScenarioOnboardingDraftPresetSection";
import { ONBOARDING_PRESET_SUMMARY_SOURCES } from "../../../member/presetJourneySummary";

const presetAllowlist = new Set<string>(MEMBER_CASE_PRESET_SEED_IDS);

const presets = getScenarioSeeds(
  createScenarioSeedTranslatorFromMessages(enMessages as Record<string, unknown>)
).filter((seed) => presetAllowlist.has(seed.id));

const requiredPresetSuggestionKeys = [
  "title",
  "badge",
  "description",
  "helper",
  "apply",
  "replace",
  "feedback",
  "replaceWarning.title",
  "replaceWarning.body",
] as const;

const requiredPresetSummaryFields = ["audience", "goal", "eta", "outcome"] as const;

const getNestedMessage = (source: Record<string, unknown>, key: string) =>
  key.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    return (value as Record<string, unknown>)[segment];
  }, source);

describe("ActiveScenarioOnboardingDraftPresetSection", () => {
  it("only allows the onboarding-incomplete surface to show the preset entry", () => {
    expect(
      shouldShowActiveScenarioOnboardingDraftPresetSection({
        isScenarioOnboardingIncomplete: true,
      })
    ).toBe(true);

    expect(
      shouldShowActiveScenarioOnboardingDraftPresetSection({
        isScenarioOnboardingIncomplete: false,
      })
    ).toBe(false);
  });

  it("renders the allowlisted member presets inside the onboarding surface", () => {
    const html = renderToString(
      <MantineProvider>
        <NextIntlClientProvider
          locale="en"
          messages={enMessages as unknown as AbstractIntlMessages}
          timeZone="UTC"
        >
          <ActiveScenarioOnboardingDraftPresetSection
            presets={presets}
            hasExistingDraft={false}
            isApplyingPreset={false}
            onApplyPreset={() => undefined}
          />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    expect(html).toContain("Pick a closer onboarding starting point");
    expect(html).toContain("Single professional | Rent &amp; save");
    expect(html).toContain("Dual-income couple | Home purchase");
    expect(html).toContain(
      "Best starting point: you are still renting today and want a first-home path without skipping your active scenario baseline setup."
    );
    expect(html).toContain(
      "Outcome after onboarding: you will leave with a baseline case, a visible runway/risk pressure view, and one first-home compare path."
    );
    expect(html).toContain("Use this starting point");
  });

  it("shows the replace warning only when an onboarding draft already exists", () => {
    const withDraftHtml = renderToString(
      <MantineProvider>
        <NextIntlClientProvider
          locale="en"
          messages={enMessages as unknown as AbstractIntlMessages}
          timeZone="UTC"
        >
          <ActiveScenarioOnboardingDraftPresetSection
            presets={presets}
            hasExistingDraft={true}
            isApplyingPreset={false}
            onApplyPreset={() => undefined}
          />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    const withoutDraftHtml = renderToString(
      <MantineProvider>
        <NextIntlClientProvider
          locale="en"
          messages={enMessages as unknown as AbstractIntlMessages}
          timeZone="UTC"
        >
          <ActiveScenarioOnboardingDraftPresetSection
            presets={presets}
            hasExistingDraft={false}
            isApplyingPreset={false}
            onApplyPreset={() => undefined}
          />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    expect(withDraftHtml).toContain("Replace current onboarding starting point?");
    expect(withDraftHtml).toContain("This replaces only the active scenario’s current onboarding draft starting point.");
    expect(withDraftHtml).toContain("Replace with this starting point");
    expect(withoutDraftHtml.includes("Replace current onboarding starting point?")).toBe(false);
    expect(withoutDraftHtml.includes("Replace with this starting point")).toBe(false);
  });

  it("keeps onboarding preset copy backed by i18n keys for both locales", () => {
    for (const key of requiredPresetSuggestionKeys) {
      expect(
        typeof getNestedMessage(enMessages.onboardingV3.presetSuggestions as Record<string, unknown>, key)
      ).toBe("string");
      expect(
        typeof getNestedMessage(zhHkMessages.onboardingV3.presetSuggestions as Record<string, unknown>, key)
      ).toBe("string");
    }

    for (const [presetId, source] of Object.entries(ONBOARDING_PRESET_SUMMARY_SOURCES)) {
      for (const field of requiredPresetSummaryFields) {
        const enValue =
          source.type === "memberJourney"
            ? getNestedMessage(enMessages.member.caseDialogs as Record<string, unknown>, `journey.${source.journeyId}.${field}`)
            : getNestedMessage(
                enMessages.onboardingV3.presetSuggestions as Record<string, unknown>,
                `presetSummaries.${source.presetSummaryKey}.${field}`
              );
        const zhValue =
          source.type === "memberJourney"
            ? getNestedMessage(zhHkMessages.member.caseDialogs as Record<string, unknown>, `journey.${source.journeyId}.${field}`)
            : getNestedMessage(
                zhHkMessages.onboardingV3.presetSuggestions as Record<string, unknown>,
                `presetSummaries.${source.presetSummaryKey}.${field}`
              );

        expect(typeof enValue, `${presetId}.${field}.en`).toBe("string");
        expect(typeof zhValue, `${presetId}.${field}.zh-HK`).toBe("string");
      }
    }
  });

  it("keeps the setup/recovery copy from implying direct baseline writes or automatic scenario completion", () => {
    const html = renderToString(
      <MantineProvider>
        <NextIntlClientProvider
          locale="en"
          messages={enMessages as unknown as AbstractIntlMessages}
          timeZone="UTC"
        >
          <ActiveScenarioOnboardingDraftPresetSection
            presets={presets}
            hasExistingDraft={true}
            isApplyingPreset={false}
            onApplyPreset={() => undefined}
          />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    expect(html).toContain("They do not write baseline events or mark onboarding complete.");
    expect(html.toLowerCase()).not.toContain("complete scenario");
    expect(html.toLowerCase()).not.toContain("directly modify baseline");
  });

  it("keeps preset entry helpers out of Plan Lab, Money, and template drawer surfaces", () => {
    const onboardingWizardSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/features/onboarding/v3/OnboardingV3Wizard.tsx"),
      "utf8"
    );
    const forbiddenSurfacePaths = [
      "app/[locale]/money/MoneyClient.tsx",
      "app/[locale]/plan-lab/PlanLabClient.tsx",
      "features/planLab/PlanLabPanel.tsx",
      "components/eventTemplates/TemplatePickerDrawer.tsx",
    ];

    expect(onboardingWizardSource).toContain("ActiveScenarioOnboardingDraftPresetSection");

    for (const relativePath of forbiddenSurfacePaths) {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
      expect(source.includes("ActiveScenarioOnboardingDraftPresetSection")).toBe(false);
      expect(source.includes("replaceActiveScenarioOnboardingDraftPresetState")).toBe(false);
    }
  });
});
