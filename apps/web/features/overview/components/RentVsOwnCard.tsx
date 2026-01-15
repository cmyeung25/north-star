// Shape note: Rent-vs-own card surfaces new home fees + holding cost fields from homes[].
// Added data: feesOneTime totals, holdingCostMonthly totals, growth percent summary.
// Back-compat: shows "Rent not configured" when no rent event exists.
import { Card, List, Stack, Text, Title } from "@mantine/core";
import { formatCurrency } from "../../../lib/i18n";
import type { RentVsOwnComparison } from "../../../src/engine/rentVsOwnComparison";

const formatPct = (value: number) => `${value.toFixed(1)}%`;

const formatDelta = (value: number, currency: string) => {
  const label = formatCurrency(Math.abs(value), currency);
  return value >= 0 ? `+${label}` : `-${label}`;
};

type RentVsOwnCardProps = {
  comparison: RentVsOwnComparison | null;
  currency: string;
};

export default function RentVsOwnCard({ comparison, currency }: RentVsOwnCardProps) {
  const assumptions = comparison?.assumptions ?? {
    rentAnnualGrowthPct: null,
    ownFeesOneTime: 0,
    ownHoldingCostMonthly: 0,
    holdingCostAnnualGrowthPct: 0,
  };

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Title order={4}>Rent vs Own</Title>
        {!comparison || comparison.status === "rent-missing" ? (
          <Text size="sm" c="dimmed">
            Rent not configured.
          </Text>
        ) : comparison.status === "insufficient-data" ? (
          <Text size="sm" c="dimmed">
            Not enough projection data to compare yet.
          </Text>
        ) : (
          <Stack gap="xs">
            <Text size="sm">
              Net worth delta (end):{" "}
              {formatDelta(comparison.netWorthDeltaAtHorizon ?? 0, currency)}
            </Text>
            {comparison.cashDeltaAtHorizon != null && (
              <Text size="sm">
                Cash delta (end):{" "}
                {formatDelta(comparison.cashDeltaAtHorizon, currency)}
              </Text>
            )}
            <Text size="sm">
              Breakeven:{" "}
              {comparison.breakevenLabel ?? "No breakeven within horizon"}
            </Text>
          </Stack>
        )}
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            Assumptions
          </Text>
          <List size="sm" spacing="xs">
            <List.Item>
              Rent escalation:{" "}
              {assumptions.rentAnnualGrowthPct != null
                ? formatPct(assumptions.rentAnnualGrowthPct)
                : "N/A"}
            </List.Item>
            <List.Item>
              Own one-time fees:{" "}
              {formatCurrency(assumptions.ownFeesOneTime, currency)}
            </List.Item>
            <List.Item>
              Own holding cost:{" "}
              {formatCurrency(assumptions.ownHoldingCostMonthly, currency)}/mo
            </List.Item>
            <List.Item>
              Holding cost growth:{" "}
              {formatPct(assumptions.holdingCostAnnualGrowthPct)}
            </List.Item>
          </List>
        </Stack>
      </Stack>
    </Card>
  );
}
