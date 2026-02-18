"use client";

import { Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useTranslations } from "next-intl";

type PageKey = "features" | "pricing" | "privacy" | "support";

export default function MarketingContentPage({ pageKey }: { pageKey: PageKey }) {
  const t = useTranslations(`marketing.pages.${pageKey}`);

  if (pageKey === "features") {
    const featureKeys = ["isolation", "quickStart", "dashboard", "planLab", "comparison", "guardrails"] as const;
    return (
      <Stack gap="lg">
        <Stack gap={4}>
          <Title c="white">{t("title")}</Title>
          <Text c="var(--mantine-color-polar-1)">{t("description")}</Text>
        </Stack>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {featureKeys.map((key) => (
            <Card key={key}>
              <Stack gap="xs">
                <Text fw={700}>{t(`cards.${key}.title`)}</Text>
                <Text size="sm" c="dimmed">
                  {t(`cards.${key}.description`)}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    );
  }

  if (pageKey === "pricing") {
    const planKeys = ["free", "pro"] as const;
    return (
      <Stack gap="lg">
        <Stack gap={4}>
          <Title c="white">{t("title")}</Title>
          <Text c="var(--mantine-color-polar-1)">{t("description")}</Text>
        </Stack>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {planKeys.map((key) => (
            <Card key={key}>
              <Stack gap="xs">
                <Text fw={700}>{t(`plans.${key}.name`)}</Text>
                <Text c="aurora.8" fw={600}>
                  {t(`plans.${key}.price`)}
                </Text>
                <Text size="sm" c="dimmed">
                  {t(`plans.${key}.description`)}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    );
  }

  if (pageKey === "privacy") {
    const itemKeys = ["storage", "export", "statement"] as const;
    return (
      <Stack gap="lg">
        <Stack gap={4}>
          <Title c="white">{t("title")}</Title>
          <Text c="var(--mantine-color-polar-1)">{t("description")}</Text>
        </Stack>
        <Stack gap="md">
          {itemKeys.map((key) => (
            <Card key={key}>
              <Stack gap="xs">
                <Text fw={700}>{t(`items.${key}.title`)}</Text>
                <Text size="sm" c="dimmed">
                  {t(`items.${key}.description`)}
                </Text>
              </Stack>
            </Card>
          ))}
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title c="white">{t("title")}</Title>
        <Text c="var(--mantine-color-polar-1)">{t("description")}</Text>
      </Stack>
      <Card>
        <Stack gap="xs">
          <Text fw={700}>{t("contact.title")}</Text>
          <Text size="sm" c="dimmed">
            {t("contact.email")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("contact.faq")}
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
