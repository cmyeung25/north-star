"use client";

import React from "react";
import { Alert, Badge, Button, Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import type { ScenarioSeedCard } from "../../../scenarios/scenarioSeeds";
import {
  JourneySummaryTextStack,
  buildOnboardingPresetJourneySummary,
} from "../../member/presetJourneySummary";
import type { MemberCasePresetSeedId } from "../seedPrefill";

type Props = {
  presets: ScenarioSeedCard[];
  hasExistingDraft: boolean;
  isApplyingPreset: boolean;
  applyingPresetId?: string | null;
  onApplyPreset: (preset: ScenarioSeedCard) => void;
};

export default function ActiveScenarioSettingsDataManagementPresetRecoverySection({
  presets,
  hasExistingDraft,
  isApplyingPreset,
  applyingPresetId,
  onApplyPreset,
}: Props) {
  const t = useTranslations("dataManagement.presetRecovery");
  const memberJourneyT = useTranslations("member.caseDialogs");
  const onboardingPresetT = useTranslations("onboardingV3.presetSuggestions");

  if (presets.length === 0) {
    return null;
  }

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Stack gap={4}>
          <Group gap="xs" wrap="wrap">
            <Text fw={600}>{t("title")}</Text>
            <Badge color="yellow" variant="light">
              {t("badge")}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t("description")}
          </Text>
          <Text size="xs" c="dimmed">
            {t("helper")}
          </Text>
        </Stack>

        {hasExistingDraft ? (
          <Alert color="yellow" radius="md" title={t("replaceWarning.title")}>
            <Text size="sm">{t("replaceWarning.body")}</Text>
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
          {presets.map((preset) => {
            const isApplyingThisPreset = isApplyingPreset && applyingPresetId === preset.id;
            const summary = buildOnboardingPresetJourneySummary({
              presetId: preset.id as MemberCasePresetSeedId,
              memberJourneyT,
              presetSuggestionT: onboardingPresetT,
            });

            return (
              <Card key={preset.id} withBorder radius="md" padding="md">
                <Stack gap="sm" h="100%">
                  <Stack gap={4}>
                    <Text fw={600}>{preset.title}</Text>
                    <Text size="sm" c="dimmed">
                      {preset.description}
                    </Text>
                    <JourneySummaryTextStack summary={summary} />
                  </Stack>

                  {preset.tags.length > 0 ? (
                    <Group gap="xs" wrap="wrap">
                      {preset.tags.map((tag) => (
                        <Badge key={`${preset.id}-${tag}`} variant="light" color="gray">
                          {tag}
                        </Badge>
                      ))}
                    </Group>
                  ) : null}

                  <Stack gap={4} style={{ flex: 1 }}>
                    {preset.keyNumbers.map((item) => (
                      <Group key={`${preset.id}-${item.label}`} justify="space-between" gap="xs">
                        <Text size="xs" c="dimmed">
                          {item.label}
                        </Text>
                        <Text size="xs" fw={600}>
                          {item.value}
                        </Text>
                      </Group>
                    ))}
                  </Stack>

                  <Button
                    variant="light"
                    color={hasExistingDraft ? "yellow" : "gray"}
                    onClick={() => onApplyPreset(preset)}
                    loading={isApplyingThisPreset}
                    disabled={isApplyingPreset && !isApplyingThisPreset}
                  >
                    {hasExistingDraft ? t("replace") : t("apply")}
                  </Button>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
