"use client";

import Link from "next/link";
import { Badge, Button, Card, Divider, Group, List, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
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
        <Text c="var(--mantine-color-polar-1)" maw={760}>
          {t("sampleJourney.subtitle")}
        </Text>
      </Stack>
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        {sampleJourneyKeys.map((journeyKey) => {
          const params = new URLSearchParams({
            journey: journeyKey,
            preset: MEMBER_JOURNEY_PRESET_MAP[journeyKey],
          });
          const href = `/${locale}/member/cases?${params.toString()}`;

          return (
            <Card key={journeyKey} bg="rgba(255,255,255,0.97)" radius="xl" p="xl">
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

                <Button component={Link} href={href} color="aurora" variant="light" mt="auto">
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
