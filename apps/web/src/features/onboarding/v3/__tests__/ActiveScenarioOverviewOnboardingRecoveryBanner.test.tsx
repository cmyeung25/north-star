import fs from "node:fs";
import path from "node:path";
import React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import enMessages from "../../../../../messages/en.json";
import { createScenarioSeedTranslatorFromMessages, getScenarioSeeds } from "../../../../scenarios/scenarioSeeds";
import { MEMBER_CASE_PRESET_SEED_IDS } from "../../seedPrefill";
import ActiveScenarioOverviewOnboardingRecoveryBanner, {
  shouldShowActiveScenarioOverviewOnboardingRecoveryBanner,
} from "../ActiveScenarioOverviewOnboardingRecoveryBanner";

const presetAllowlist = new Set<string>(MEMBER_CASE_PRESET_SEED_IDS);

const presets = getScenarioSeeds(
  createScenarioSeedTranslatorFromMessages(enMessages as Record<string, unknown>)
).filter((seed) => presetAllowlist.has(seed.id));

describe("ActiveScenarioOverviewOnboardingRecoveryBanner", () => {
  it("only shows on active scenarios that still have onboarding recovery gaps", () => {
    expect(
      shouldShowActiveScenarioOverviewOnboardingRecoveryBanner({
        isScenarioActive: true,
        hasOnboardingRecoveryGaps: true,
      })
    ).toBe(true);

    expect(
      shouldShowActiveScenarioOverviewOnboardingRecoveryBanner({
        isScenarioActive: true,
        hasOnboardingRecoveryGaps: false,
      })
    ).toBe(false);

    expect(
      shouldShowActiveScenarioOverviewOnboardingRecoveryBanner({
        isScenarioActive: false,
        hasOnboardingRecoveryGaps: true,
      })
    ).toBe(false);
  });

  it("keeps dashboard recovery copy explicit about returning to onboarding instead of editing baseline directly", () => {
    const html = renderToString(
      <MantineProvider>
        <NextIntlClientProvider
          locale="en"
          messages={enMessages as unknown as AbstractIntlMessages}
          timeZone="UTC"
        >
          <ActiveScenarioOverviewOnboardingRecoveryBanner
            presets={presets}
            hasExistingDraft={true}
            isApplyingPreset={false}
            onApplyPreset={() => undefined}
          />
        </NextIntlClientProvider>
      </MantineProvider>
    );

    expect(html).toContain("Return to onboarding before you treat this scenario as finished");
    expect(html).toContain(
      "These recovery presets only replace this active scenario’s onboarding draft starting point."
    );
    expect(html).toContain(
      "and we will take you back to onboarding so you can review each step and confirm the baseline there before returning to dashboard."
    );
    expect(html).toContain("Choose a recovery starting point");
    expect(html).toContain("These are onboarding recovery presets—not Plan Lab experiments or Money event templates.");
    expect(html).toContain("Replace draft and return to onboarding");
    expect(html.toLowerCase()).not.toContain("complete scenario");
    expect(html.toLowerCase()).not.toContain("directly modify baseline");
  });

  it("keeps the dashboard recovery banner scoped away from Plan Lab, Money, and baseline event drawers", () => {
    const overviewClientSource = fs.readFileSync(
      path.resolve(process.cwd(), "app/[locale]/overview/OverviewClient.tsx"),
      "utf8"
    );
    const forbiddenSurfacePaths = [
      "app/[locale]/money/MoneyClient.tsx",
      "app/[locale]/plan-lab/PlanLabClient.tsx",
      "features/planLab/PlanLabPanel.tsx",
      "components/eventTemplates/TemplatePickerDrawer.tsx",
    ];

    expect(overviewClientSource).toContain("ActiveScenarioOverviewOnboardingRecoveryBanner");

    for (const relativePath of forbiddenSurfacePaths) {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
      expect(source.includes("ActiveScenarioOverviewOnboardingRecoveryBanner")).toBe(false);
      expect(source.includes("shouldShowActiveScenarioOverviewOnboardingRecoveryBanner")).toBe(
        false
      );
    }
  });
});
