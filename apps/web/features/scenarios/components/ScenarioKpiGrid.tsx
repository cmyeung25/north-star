import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import type { Scenario } from "../types";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../utils";

type ScenarioKpiGridProps = {
  scenario: Scenario;
};

export default function ScenarioKpiGrid({ scenario }: ScenarioKpiGridProps) {
  const t = useTranslations("scenarios");
  const locale = useLocale();
  const kpis = [
    {
      label: t("lowestBalance"),
      value: formatCurrency(
        scenario.kpis.lowestMonthlyBalance,
        scenario.baseCurrency,
        locale
      ),
    },
    {
      label: t("runway"),
      value: t("runwayValue", { months: scenario.kpis.runwayMonths }),
    },
    {
      label: t("netWorth5y"),
      value: formatCurrency(
        scenario.kpis.netWorthYear5,
        scenario.baseCurrency,
        locale
      ),
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
      {kpis.map((kpi) => (
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
