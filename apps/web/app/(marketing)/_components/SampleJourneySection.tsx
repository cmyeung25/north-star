"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Badge, Button, Card, Divider, Group, List, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import {
  buildMemberCasesEntryHref,
  MEMBER_JOURNEY_PRESET_MAP,
  type MemberJourneyId,
} from "../../../src/features/member/createCaseEntry";
import { trackMarketEntryEvent, trackMarketEntryExposureOnce } from "../../../src/lib/analytics/marketEntry";

type SampleJourneyKey = Extract<MemberJourneyId, "officeSaver" | "coupleHome" | "newParents">;

const sampleJourneyKeys: SampleJourneyKey[] = ["officeSaver", "coupleHome", "newParents"];
const sampleJourneySteps = ["one", "two", "three"] as const;
const sampleJourneyOutputs = ["runway", "risk", "compare"] as const;

export default function SampleJourneySection({ isSignedIn }: { isSignedIn: boolean }) {
  const t = useTranslations("marketing.web");
  const locale = useLocale();
  const cardRefs = useRef(new Map<SampleJourneyKey, HTMLDivElement | null>());
  const trackedJourneyImpressionsRef = useRef(new Set<SampleJourneyKey>());

  const journeyEntries = useMemo(
    () =>
      sampleJourneyKeys.map((journeyKey) => ({
        journeyKey,
        presetId: MEMBER_JOURNEY_PRESET_MAP[journeyKey],
        href: buildMemberCasesEntryHref(locale, {
          journey: journeyKey,
          presetId: MEMBER_JOURNEY_PRESET_MAP[journeyKey],
        }),
      })),
    [locale],
  );

  useEffect(() => {
    const trackJourneyImpression = (journeyKey: SampleJourneyKey, presetId: string) => {
      trackMarketEntryExposureOnce({
        seenExposureKeys: trackedJourneyImpressionsRef.current,
        exposureKey: journeyKey,
        name: "sample_journey_impression",
        payload: {
          locale,
          journeyId: journeyKey,
          presetId,
          isSignedIn,
        },
      });
    };

    if (typeof window === "undefined") {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      for (const entry of journeyEntries) {
        trackJourneyImpression(entry.journeyKey, entry.presetId);
      }
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          const journeyKey = entry.target.getAttribute("data-journey-id") as SampleJourneyKey | null;
          if (!journeyKey) {
            return;
          }
          trackJourneyImpression(journeyKey, MEMBER_JOURNEY_PRESET_MAP[journeyKey]);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.35 },
    );

    for (const entry of journeyEntries) {
      const node = cardRefs.current.get(entry.journeyKey);
      if (node) {
        observer.observe(node);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [isSignedIn, journeyEntries, locale]);

  return (
    <Stack gap="md">
      <Stack gap={6}>
        <Title order={2} c="white">
          {t("sampleJourney.title")}
        </Title>
        <Text c="var(--mantine-color-polar-1)" maw={760}>
          {t("sampleJourney.subtitle")}
        </Text>
      </Stack>
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        {journeyEntries.map(({ journeyKey, presetId, href }) => {
          return (
            <Card
              key={journeyKey}
              bg="rgba(255,255,255,0.97)"
              radius="xl"
              p="xl"
              ref={(node) => {
                cardRefs.current.set(journeyKey, node);
              }}
              data-journey-id={journeyKey}
            >
              <Stack gap="md" h="100%">
                <Badge color="aurora" variant="light" w="fit-content" size="lg">
                  {t(`sampleJourney.journeys.${journeyKey}.title`)}
                </Badge>

                <Stack gap={4}>
                  <Text fw={700}>{t("sampleJourney.startTitle")}</Text>
                  <Text size="sm" c="dimmed">
                    {t(`sampleJourney.journeys.${journeyKey}.startCondition`)}
                  </Text>
                </Stack>

                <Paper p="md" radius="lg" bg="rgba(11, 27, 58, 0.04)">
                  <Stack gap={4}>
                    <Text size="xs" tt="uppercase" fw={700} c="aurora.8">
                      {t("sampleJourney.decisionTitle")}
                    </Text>
                    <Text fw={600}>{t(`sampleJourney.journeys.${journeyKey}.decisionQuestion`)}</Text>
                  </Stack>
                </Paper>

                <Divider />

                <Stack gap={4}>
                  <Text fw={700}>{t("sampleJourney.stepsTitle")}</Text>
                  <List spacing="xs" size="sm">
                    {sampleJourneySteps.map((stepKey, index) => (
                      <List.Item key={stepKey} c="dimmed">
                        {t("sampleJourney.step", { number: index + 1 })} · {t(`sampleJourney.journeys.${journeyKey}.steps.${stepKey}`)}
                      </List.Item>
                    ))}
                  </List>
                </Stack>

                <Stack gap={4}>
                  <Text fw={700}>{t("sampleJourney.outputTitle")}</Text>
                  <Group gap="xs">
                    {sampleJourneyOutputs.map((outputKey) => (
                      <Badge key={outputKey} color="aurora" variant="light">
                        {t(`sampleJourney.journeys.${journeyKey}.outputs.${outputKey}`)}
                      </Badge>
                    ))}
                  </Group>
                </Stack>

                <Button
                  component={Link}
                  href={href}
                  color="aurora"
                  variant="light"
                  mt="auto"
                  onClick={() => {
                    trackMarketEntryEvent("journey_cta_click", {
                      locale,
                      journeyId: journeyKey,
                      presetId,
                      isSignedIn,
                    });
                  }}
                >
                  {t("sampleJourney.cta")}
                </Button>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
