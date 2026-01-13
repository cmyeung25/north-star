import { Badge, Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { formatCurrency } from "../../../lib/i18n";
import type { Kpis } from "../types";

type BeforeAfterKpiGridProps = {
  baseline: Kpis;
  stressed: Kpis;
  currency: string;
};

const riskColorMap: Record<Kpis["riskLevel"], string> = {
  Low: "green",
  Medium: "yellow",
  High: "red",
};

const KpiCard = ({
  label,
  kpis,
  currency,
}: {
  label: string;
  kpis: Kpis;
  currency: string;
}) => (
  <Card withBorder radius="md" shadow="sm" padding="md">
    <Stack gap="sm">
      <Title order={5}>{label}</Title>
      <Stack gap={6}>
        <Text size="sm" c="dimmed">
          Lowest monthly balance
        </Text>
        <Text fw={600}>{formatCurrency(kpis.lowestMonthlyBalance, currency)}</Text>
        <Text size="sm" c="dimmed">
          Runway months
        </Text>
        <Text fw={600}>{kpis.runwayMonths}</Text>
        <Text size="sm" c="dimmed">
          Net worth (year 5)
        </Text>
        <Text fw={600}>{formatCurrency(kpis.netWorthYear5, currency)}</Text>
        <Text size="sm" c="dimmed">
          Risk level
        </Text>
        <Badge color={riskColorMap[kpis.riskLevel]} variant="light">
          {kpis.riskLevel}
        </Badge>
      </Stack>
    </Stack>
  </Card>
);

export default function BeforeAfterKpiGrid({
  baseline,
  stressed,
  currency,
}: BeforeAfterKpiGridProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      <KpiCard label="Before" kpis={baseline} currency={currency} />
      <KpiCard label="After" kpis={stressed} currency={currency} />
    </SimpleGrid>
  );
}
