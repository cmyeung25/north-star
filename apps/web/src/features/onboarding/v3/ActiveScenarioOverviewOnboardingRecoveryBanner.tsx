"use client";

import React from "react";
import { Alert, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import type { ScenarioSeedCard } from "../../../scenarios/scenarioSeeds";
import ActiveScenarioOnboardingDraftPresetSection from "./ActiveScenarioOnboardingDraftPresetSection";

type Props = {
  presets: ScenarioSeedCard[];
  hasExistingDraft: boolean;
  isApplyingPreset: boolean;
  applyingPresetId?: string | null;
  onApplyPreset: (preset: ScenarioSeedCard) => void;
};

export const shouldShowActiveScenarioOverviewOnboardingRecoveryBanner = (options: {
  isScenarioActive: boolean;
  hasOnboardingRecoveryGaps: boolean;
}) => options.isScenarioActive && options.hasOnboardingRecoveryGaps;

export default function ActiveScenarioOverviewOnboardingRecoveryBanner({
  presets,
  hasExistingDraft,
  isApplyingPreset,
  applyingPresetId,
  onApplyPreset,
}: Props) {
  const t = useTranslations("overview.dashboard.onboardingRecovery");

  if (presets.length === 0) {
    return null;
  }

  return (
    <Stack gap="md">
      <Alert color="aurora" radius="md" title={t("title")}>
        <Stack gap={4}>
          <Text size="sm">{t("description")}</Text>
          <Text size="sm">{t("helper")}</Text>
        </Stack>
      </Alert>

      <ActiveScenarioOnboardingDraftPresetSection
        presets={presets}
        hasExistingDraft={hasExistingDraft}
        isApplyingPreset={isApplyingPreset}
        applyingPresetId={applyingPresetId}
        onApplyPreset={onApplyPreset}
      />
    </Stack>
  );
}
