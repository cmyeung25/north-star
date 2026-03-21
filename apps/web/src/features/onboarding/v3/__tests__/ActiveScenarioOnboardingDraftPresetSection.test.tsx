import fs from "node:fs";
import path from "node:path";
import React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import enMessages from "../../../../../messages/en.json";
import {
  createScenarioSeedTranslatorFromMessages,
  getScenarioSeeds,
} from "../../../../scenarios/scenarioSeeds";
import { MEMBER_CASE_PRESET_SEED_IDS } from "../../seedPrefill";
import ActiveScenarioOnboardingDraftPresetSection, {
  shouldShowActiveScenarioOnboardingDraftPresetSection,
} from "../ActiveScenarioOnboardingDraftPresetSection";

const presetAllowlist = new Set<string>(MEMBER_CASE_PRESET_SEED_IDS);

const presets = getScenarioSeeds(
  createScenarioSeedTranslatorFromMessages(enMessages as Record<string, unknown>)
).filter((seed) => presetAllowlist.has(seed.id));

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
            isApplyingPreset={false}
            onApplyPreset={() => undefined}
          />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    expect(html).toContain("Pick a closer onboarding starting point");
    expect(html).toContain("Single professional | Rent &amp; save");
    expect(html).toContain("Dual-income couple | Home purchase");
    expect(html).toContain("Use this preset");
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
