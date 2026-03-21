"use client";

import React from "react";
import { Card, Stack, Text } from "@mantine/core";
import type { MemberCasePresetSeedId } from "../onboarding/seedPrefill";
import type { MemberJourneyId } from "./createCaseEntry";

export type JourneySummary = {
  audience: string;
  goal: string;
  eta: string;
  outcome: string;
};

type SummaryTranslator = (key: string) => string;

type PresetSummarySource =
  | {
      type: "memberJourney";
      journeyId: MemberJourneyId;
    }
  | {
      type: "presetSuggestion";
      presetSummaryKey:
        | "dualIncomeRental"
        | "newBabyHelper";
    };

export const ONBOARDING_PRESET_SUMMARY_SOURCES: Record<
  MemberCasePresetSeedId,
  PresetSummarySource
> = {
  "single-renter": {
    type: "memberJourney",
    journeyId: "officeSaver",
  },
  "dual-income-home": {
    type: "memberJourney",
    journeyId: "coupleHome",
  },
  "dual-income-rental": {
    type: "presetSuggestion",
    presetSummaryKey: "dualIncomeRental",
  },
  "new-baby": {
    type: "memberJourney",
    journeyId: "newParents",
  },
  "new-baby-helper": {
    type: "presetSuggestion",
    presetSummaryKey: "newBabyHelper",
  },
  "high-asset": {
    type: "memberJourney",
    journeyId: "mortgageOwner",
  },
};

export function buildMemberJourneySummary(
  t: SummaryTranslator,
  journeyId: MemberJourneyId
): JourneySummary {
  return {
    audience: t(`journey.${journeyId}.audience`),
    goal: t(`journey.${journeyId}.goal`),
    eta: t(`journey.${journeyId}.eta`),
    outcome: t(`journey.${journeyId}.outcome`),
  };
}

export function buildOnboardingPresetJourneySummary(options: {
  presetId: MemberCasePresetSeedId;
  memberJourneyT: SummaryTranslator;
  presetSuggestionT: SummaryTranslator;
}): JourneySummary {
  const source = ONBOARDING_PRESET_SUMMARY_SOURCES[options.presetId];

  if (source.type === "memberJourney") {
    return buildMemberJourneySummary(options.memberJourneyT, source.journeyId);
  }

  return {
    audience: options.presetSuggestionT(`presetSummaries.${source.presetSummaryKey}.audience`),
    goal: options.presetSuggestionT(`presetSummaries.${source.presetSummaryKey}.goal`),
    eta: options.presetSuggestionT(`presetSummaries.${source.presetSummaryKey}.eta`),
    outcome: options.presetSuggestionT(`presetSummaries.${source.presetSummaryKey}.outcome`),
  };
}

export function JourneySummaryTextStack({
  summary,
  gap = 4,
}: {
  summary: JourneySummary;
  gap?: number | string;
}) {
  return (
    <Stack gap={gap}>
      <Text size="sm" c="dimmed">
        {summary.audience}
      </Text>
      <Text size="sm" c="dimmed">
        {summary.goal}
      </Text>
      <Text size="sm" c="dimmed">
        {summary.eta}
      </Text>
      <Text size="sm" c="dimmed">
        {summary.outcome}
      </Text>
    </Stack>
  );
}

export function JourneySummaryCard({
  title,
  summary,
}: {
  title: string;
  summary: JourneySummary;
}) {
  return (
    <Card withBorder radius="md" padding="sm" bg="gray.0">
      <Stack gap={4}>
        <Text fw={600} size="sm">
          {title}
        </Text>
        <JourneySummaryTextStack summary={summary} />
      </Stack>
    </Card>
  );
}
