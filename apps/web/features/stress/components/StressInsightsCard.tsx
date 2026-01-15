import { Card, List, Stack, Text, Title } from "@mantine/core";
import { useTranslations } from "next-intl";
import type { Kpis } from "../types";

type StressInsightsCardProps = {
  riskLevel: Kpis["riskLevel"];
};

export default function StressInsightsCard({
  riskLevel,
}: StressInsightsCardProps) {
  const t = useTranslations("stress");
  const insights = t.raw(`insights.${riskLevel.toLowerCase()}`) as string[];
  return (
    <Card withBorder radius="md" shadow="sm" padding="lg">
      <Stack gap="sm">
        <Title order={5}>{t("insightsTitle")}</Title>
        <Text size="sm" c="dimmed">
          {t("insightsSubtitle")}
        </Text>
        <List spacing="xs" size="sm">
          {insights.map((insight) => (
            <List.Item key={insight}>{insight}</List.Item>
          ))}
        </List>
      </Stack>
    </Card>
  );
}
