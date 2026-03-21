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
import { ONBOARDING_PRESET_SUMMARY_SOURCES } from "../../../member/presetJourneySummary";
import ActiveScenarioSettingsDataManagementPresetRecoverySection from "../ActiveScenarioSettingsDataManagementPresetRecoverySection";

const presetAllowlist = new Set<string>(MEMBER_CASE_PRESET_SEED_IDS);

const presets = getScenarioSeeds(
  createScenarioSeedTranslatorFromMessages(enMessages as Record<string, unknown>)
).filter((seed) => presetAllowlist.has(seed.id));

const requiredSettingsPresetRecoveryKeys = [
  "title",
  "badge",
  "description",
  "helper",
  "apply",
  "replace",
  "replaceWarning.title",
  "replaceWarning.body",
  "redirecting.title",
  "redirecting.description",
] as const;

const requiredPresetSummaryFields = ["audience", "goal", "eta", "outcome"] as const;

const getNestedMessage = (source: Record<string, unknown>, key: string) =>
  key.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    return (value as Record<string, unknown>)[segment];
  }, source);

const forbiddenSurfacePaths = [
  "app/[locale]/money/MoneyClient.tsx",
  "app/[locale]/plan-lab/PlanLabClient.tsx",
  "features/planLab/PlanLabPanel.tsx",
  "components/eventTemplates/TemplatePickerDrawer.tsx",
  "features/moneyFlow/CashflowEventDrawer.tsx",
  "features/moneyFlow/HousingEventDrawer.tsx",
  "features/moneyFlow/InsuranceEventDrawer.tsx",
  "features/moneyFlow/LoanEventDrawer.tsx",
  "features/assets/AssetManager.tsx",
  "features/assets/ScenarioAssetManager.tsx",
  "features/liabilities/LiabilityManager.tsx",
  "features/liabilities/ScenarioLiabilityManager.tsx",
] as const;

describe("ActiveScenarioSettingsDataManagementPresetRecoverySection", () => {
  it("renders the allowlisted member presets with restrained data-management copy", () => {
    const html = renderToString(
      <MantineProvider>
        <NextIntlClientProvider
          locale="en"
          messages={enMessages as unknown as AbstractIntlMessages}
          timeZone="UTC"
        >
          <ActiveScenarioSettingsDataManagementPresetRecoverySection
            presets={presets}
            hasExistingDraft={false}
            isApplyingPreset={false}
            onApplyPreset={() => undefined}
          />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    expect(html).toContain("Restart this scenario from a preset draft");
    expect(html).toContain("Single professional | Rent &amp; save");
    expect(html).toContain(
      "Expected setup time: around 5–8 minutes."
    );
    expect(html).toContain(
      "Outcome after onboarding: you will leave with a baseline case, a visible runway/risk pressure view, and one first-home compare path."
    );
    expect(html).toContain("Start from this preset");
  });

  it("shows replace warning and replace CTA only when this active scenario already has an onboarding draft", () => {
    const withDraftHtml = renderToString(
      <MantineProvider>
        <NextIntlClientProvider
          locale="en"
          messages={enMessages as unknown as AbstractIntlMessages}
          timeZone="UTC"
        >
          <ActiveScenarioSettingsDataManagementPresetRecoverySection
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
          <ActiveScenarioSettingsDataManagementPresetRecoverySection
            presets={presets}
            hasExistingDraft={false}
            isApplyingPreset={false}
            onApplyPreset={() => undefined}
          />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    expect(withDraftHtml).toContain("Replace this scenario’s current onboarding draft?");
    expect(withDraftHtml).toContain(
      "This only replaces the active scenario’s current onboarding draft starting point and sends you back through onboarding to confirm it there."
    );
    expect(withDraftHtml).toContain("Replace current draft");
    expect(withoutDraftHtml.includes("Replace this scenario’s current onboarding draft?")).toBe(false);
    expect(withoutDraftHtml.includes("Replace current draft")).toBe(false);
  });

  it("keeps settings preset recovery copy backed by i18n keys for both locales", () => {
    for (const key of requiredSettingsPresetRecoveryKeys) {
      expect(typeof getNestedMessage(enMessages.dataManagement.presetRecovery as Record<string, unknown>, key)).toBe("string");
      expect(typeof getNestedMessage(zhHkMessages.dataManagement.presetRecovery as Record<string, unknown>, key)).toBe("string");
    }

    for (const [presetId, source] of Object.entries(ONBOARDING_PRESET_SUMMARY_SOURCES)) {
      for (const field of requiredPresetSummaryFields) {
        const enValue =
          source.type === "memberJourney"
            ? getNestedMessage(
                enMessages.member.caseDialogs as Record<string, unknown>,
                `journey.${source.journeyId}.${field}`
              )
            : getNestedMessage(
                enMessages.onboardingV3.presetSuggestions as Record<string, unknown>,
                `presetSummaries.${source.presetSummaryKey}.${field}`
              );
        const zhValue =
          source.type === "memberJourney"
            ? getNestedMessage(
                zhHkMessages.member.caseDialogs as Record<string, unknown>,
                `journey.${source.journeyId}.${field}`
              )
            : getNestedMessage(
                zhHkMessages.onboardingV3.presetSuggestions as Record<string, unknown>,
                `presetSummaries.${source.presetSummaryKey}.${field}`
              );

        expect(typeof enValue, `${presetId}.${field}.en`).toBe("string");
        expect(typeof zhValue, `${presetId}.${field}.zh-HK`).toBe("string");
      }
    }
  });

  it("keeps the settings recovery entry scoped away from Plan Lab, Money, and baseline event drawers", () => {
    const dataManagementSource = fs.readFileSync(
      path.resolve(process.cwd(), "components/DataManagementSection.tsx"),
      "utf8"
    );

    expect(dataManagementSource).toContain(
      "ActiveScenarioSettingsDataManagementPresetRecoverySection"
    );
    expect(dataManagementSource).toContain("replaceActiveScenarioOnboardingDraftPresetState");

    for (const relativePath of forbiddenSurfacePaths) {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
      expect(source.includes("ActiveScenarioSettingsDataManagementPresetRecoverySection")).toBe(false);
      expect(source.includes("dataManagement.presetRecovery")).toBe(false);
      expect(source.includes("replaceActiveScenarioOnboardingDraftPresetState")).toBe(false);
    }
  });
});
