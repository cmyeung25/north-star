import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import type { Scenario } from "../types";
import { formatCurrency } from "../utils";

type ScenarioKpiGridProps = {
  scenario: Scenario;
};

export default function ScenarioKpiGrid({ scenario }: ScenarioKpiGridProps) {
  const kpis = [
    {
      label: "Lowest Balance",
      value: formatCurrency(
        scenario.kpis.lowestMonthlyBalance,
        scenario.baseCurrency
      ),
    },
    {
      label: "Runway",
      value: `${scenario.kpis.runwayMonths} mo`,
    },
    {
      label: "5Y Net Worth",
      value: formatCurrency(scenario.kpis.netWorthYear5, scenario.baseCurrency),
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
