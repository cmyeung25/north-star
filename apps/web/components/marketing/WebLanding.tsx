"use client";

import Link from "next/link";
import {
  Accordion,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useTranslations } from "next-intl";

export default function WebLanding() {
  const t = useTranslations("marketing.web");

  const featureKeys = ["isolation", "quickStart", "dashboard", "planLab", "comparison", "guardrails"] as const;
  const stepKeys = ["one", "two", "three"] as const;
  const faqKeys = ["one", "two", "three", "four"] as const;

  return (
    <Stack gap={56}>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: "xl", md: 48 }}>
        <Stack gap="lg" justify="center">
          <Badge variant="light" color="aurora" size="lg" w="fit-content">
            {t("hero.badge")}
          </Badge>
          <Stack gap="sm">
            <Title order={1} c="white" maw={560}>
              {t("hero.title")}
            </Title>
            <Text c="var(--mantine-color-polar-1)" maw={560}>
              {t("hero.subtitle")}
            </Text>
          </Stack>
          <Group gap="sm" wrap="wrap">
            <Button component={Link} href="/auth/login?intent=register" size="md" color="aurora">
              {t("cta.start")}
            </Button>
            <Button component={Link} href="/auth/login" size="md" variant="outline" c="white">
              {t("cta.login")}
            </Button>
            <Anchor component={Link} href="/member/cases" c="aurora.2" fw={600}>
              {t("cta.goCases")}
            </Anchor>
          </Group>
        </Stack>
        <Card
          bg="rgba(11, 27, 58, 0.45)"
          style={{ backdropFilter: "blur(8px)", borderColor: "rgba(184, 203, 255, 0.4)" }}
          p="xl"
        >
          <Stack gap="md">
            <Text fw={700} c="white">
              {t("snapshot.title")}
            </Text>
            <Paper p="md" radius="md" bg="rgba(35, 213, 171, 0.15)">
              <Text fw={600} c="white">
                {t("snapshot.case")}
              </Text>
              <Text size="sm" c="var(--mantine-color-polar-1)">
                {t("snapshot.detail")}
              </Text>
            </Paper>
            <Stack gap={6} c="var(--mantine-color-polar-1)">
              <Text size="sm">• {t("snapshot.points.cashflow")}</Text>
              <Text size="sm">• {t("snapshot.points.netWorth")}</Text>
              <Text size="sm">• {t("snapshot.points.guardrails")}</Text>
            </Stack>
          </Stack>
        </Card>
      </SimpleGrid>

      <Stack gap="md">
        <Title order={2} c="white">
          {t("section.features")}
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {featureKeys.map((key) => (
            <Card key={key} bg="white" h="100%">
              <Stack gap="sm">
                <Group gap="xs" align="center">
                  <ThemeIcon radius="xl" color="aurora" variant="light" size="lg">
                    <Text>{t(`features.${key}.icon`)}</Text>
                  </ThemeIcon>
                  <Text fw={600}>{t(`features.${key}.title`)}</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  {t(`features.${key}.description`)}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>

      <Stack gap="md">
        <Title order={2} c="white">
          {t("section.flow")}
        </Title>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {stepKeys.map((key, index) => (
            <Card key={key} bg="rgba(255,255,255,0.96)">
              <Stack gap="xs">
                <Badge variant="filled" color="aurora" w="fit-content">
                  {t("flow.step", { number: index + 1 })}
                </Badge>
                <Text fw={600}>{t(`flow.${key}`)}</Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>

      <Stack gap="md">
        <Title order={2} c="white">
          {t("section.faq")}
        </Title>
        <Accordion radius="md" variant="contained">
          {faqKeys.map((key) => (
            <Accordion.Item key={key} value={key}>
              <Accordion.Control>{t(`faq.${key}.q`)}</Accordion.Control>
              <Accordion.Panel>{t(`faq.${key}.a`)}</Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Stack>
    </Stack>
  );
}
