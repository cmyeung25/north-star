import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import type { Scenario, ScenarioKpis } from "../types";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../utils";

type ScenarioKpiGridProps = {
  scenario: Scenario;
  kpis?: ScenarioKpis;
};

export default function ScenarioKpiGrid({ scenario, kpis }: ScenarioKpiGridProps) {
  const t = useTranslations("scenarios");
  const locale = useLocale();
  const resolvedKpis = kpis ?? scenario.kpis;
  const kpiItems = [
    {
      label: t("lowestBalance"),
      value: formatCurrency(
        resolvedKpis.lowestMonthlyBalance,
        scenario.baseCurrency,
        locale
      ),
    },
    {
      label: t("runway"),
      value: t("runwayValue", { months: resolvedKpis.runwayMonths }),
    },
    {
      label: t("netWorth5y"),
      value: formatCurrency(
        resolvedKpis.netWorthYear5,
        scenario.baseCurrency,
        locale
      ),
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
      {kpiItems.map((kpi) => (
        <Card key={kpi.label} withBorder radius="md" padding="sm">
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {kpi.label}
            </Text>
            <Text fw={600}>{kpi.value}</Text>
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
}
