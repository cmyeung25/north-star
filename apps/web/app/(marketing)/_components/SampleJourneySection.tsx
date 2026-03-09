"use client";

import Link from "next/link";
import { Badge, Button, Card, Group, List, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { MEMBER_JOURNEY_PRESET_MAP } from "../../../src/features/member/createCaseEntry";

type SampleJourneyKey = "officeSaver" | "coupleHome" | "newParents";

const sampleJourneyKeys: SampleJourneyKey[] = ["officeSaver", "coupleHome", "newParents"];
const sampleJourneySteps = ["one", "two", "three"] as const;
const sampleJourneyOutputs = ["runway", "risk", "compare"] as const;

export default function SampleJourneySection() {
  const t = useTranslations("marketing.web");
  const locale = useLocale();

  return (
    <Stack gap="md">
      <Stack gap={6}>
        <Title order={2} c="white">
          {t("sampleJourney.title")}
        </Title>
        <Text c="var(--mantine-color-polar-1)">{t("sampleJourney.subtitle")}</Text>
      </Stack>
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        {sampleJourneyKeys.map((journeyKey) => {
          const params = new URLSearchParams({
            journey: journeyKey,
            preset: MEMBER_JOURNEY_PRESET_MAP[journeyKey],
          });
          const href = `/${locale}/member/cases?${params.toString()}`;

          return (
            <Card key={journeyKey} bg="rgba(255,255,255,0.96)">
              <Stack gap="sm">
                <Badge color="aurora" variant="light" w="fit-content">
                  {t(`sampleJourney.journeys.${journeyKey}.title`)}
                </Badge>

                <Stack gap={4}>
                  <Text fw={700}>{t("sampleJourney.startTitle")}</Text>
                  <Text size="sm" c="dimmed">
                    {t(`sampleJourney.journeys.${journeyKey}.startCondition`)}
                  </Text>
                </Stack>

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
                      <ThemeIcon key={outputKey} radius="xl" size="sm" color="aurora" variant="light">
                        <Text size="xs">{t(`sampleJourney.journeys.${journeyKey}.outputs.${outputKey}`)}</Text>
                      </ThemeIcon>
                    ))}
                  </Group>
                </Stack>

                <Button component={Link} href={href} color="aurora" variant="light">
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
