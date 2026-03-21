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
  copy?: {
    title: string;
    badge: string;
    description: string;
    helper: string;
    apply: string;
    replace: string;
    replaceWarningTitle: string;
    replaceWarningBody: string;
  };
};

export const shouldShowActiveScenarioOnboardingDraftPresetSection = (options: {
  isScenarioOnboardingIncomplete: boolean;
}) => options.isScenarioOnboardingIncomplete;

export default function ActiveScenarioOnboardingDraftPresetSection({
  presets,
  hasExistingDraft,
  isApplyingPreset,
  applyingPresetId,
  onApplyPreset,
  copy,
}: Props) {
  const t = useTranslations("onboardingV3.presetSuggestions");
  const memberJourneyT = useTranslations("member.caseDialogs");
  const resolvedCopy = copy ?? {
    title: t("title"),
    badge: t("badge"),
    description: t("description"),
    helper: t("helper"),
    apply: t("apply"),
    replace: t("replace"),
    replaceWarningTitle: t("replaceWarning.title"),
    replaceWarningBody: t("replaceWarning.body"),
  };

  if (presets.length === 0) {
    return null;
  }

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Stack gap={4}>
          <Group gap="xs" wrap="wrap">
            <Text fw={700}>{resolvedCopy.title}</Text>
            <Badge color="aurora" variant="light">
              {resolvedCopy.badge}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {resolvedCopy.description}
          </Text>
          <Text size="xs" c="dimmed">
            {resolvedCopy.helper}
          </Text>
        </Stack>
        {hasExistingDraft ? (
          <Alert color="yellow" radius="md" title={resolvedCopy.replaceWarningTitle}>
            <Text size="sm">{resolvedCopy.replaceWarningBody}</Text>
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
          {presets.map((preset) => {
            const isApplyingThisPreset = isApplyingPreset && applyingPresetId === preset.id;
            const summary = buildOnboardingPresetJourneySummary({
              presetId: preset.id as MemberCasePresetSeedId,
              memberJourneyT,
              presetSuggestionT: t,
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
                    onClick={() => onApplyPreset(preset)}
                    loading={isApplyingThisPreset}
                    disabled={isApplyingPreset && !isApplyingThisPreset}
                  >
                    {hasExistingDraft ? resolvedCopy.replace : resolvedCopy.apply}
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
