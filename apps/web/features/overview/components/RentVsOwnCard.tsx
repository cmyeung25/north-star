// Shape note: Rent-vs-own card surfaces new home fees + holding cost fields from homes[].
// Added data: feesOneTime totals, holdingCostMonthly totals, growth percent summary.
// Back-compat: shows "Rent not configured" when no rent event exists.
import { Card, List, Stack, Text, Title } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../../../lib/i18n";
import type { RentVsOwnComparison } from "../../../src/engine/rentVsOwnComparison";

const formatPct = (value: number) => `${value.toFixed(1)}%`;

type RentVsOwnCardProps = {
  comparison: RentVsOwnComparison | null;
  currency: string;
};

export default function RentVsOwnCard({ comparison, currency }: RentVsOwnCardProps) {
  const t = useTranslations("overview");
  const assumptionsT = useTranslations("assumptions");
  const locale = useLocale();
  const assumptions = comparison?.assumptions ?? {
    rentAnnualGrowthPct: null,
    ownFeesOneTime: 0,
    ownHoldingCostMonthly: 0,
    holdingCostAnnualGrowthPct: 0,
  };
  const formatDelta = (value: number) => {
    const label = formatCurrency(Math.abs(value), currency, locale);
    return value >= 0 ? `+${label}` : `-${label}`;
  };

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Title order={4}>{t("rentVsOwnTitle")}</Title>
        {!comparison || comparison.status === "rent-missing" ? (
          <Text size="sm" c="dimmed">
            {t("rentNotConfigured")}
          </Text>
        ) : comparison.status === "insufficient-data" ? (
          <Text size="sm" c="dimmed">
            {t("rentVsOwnInsufficient")}
          </Text>
        ) : (
          <Stack gap="xs">
            <Text size="sm">
              {t("netWorthDeltaEnd", {
                value: formatDelta(comparison.netWorthDeltaAtHorizon ?? 0),
              })}
            </Text>
            {comparison.cashDeltaAtHorizon != null && (
              <Text size="sm">
                {t("cashDeltaEnd", { value: formatDelta(comparison.cashDeltaAtHorizon) })}
              </Text>
            )}
            <Text size="sm">
              {t("breakevenLabel", {
                value: comparison.breakevenLabel ?? t("noBreakeven"),
              })}
            </Text>
          </Stack>
        )}
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            {assumptionsT("title")}
          </Text>
          <List size="sm" spacing="xs">
            <List.Item>
              {assumptionsT("rentEscalation", {
                value:
                  assumptions.rentAnnualGrowthPct != null
                    ? formatPct(assumptions.rentAnnualGrowthPct)
                    : assumptionsT("notAvailable"),
              })}
            </List.Item>
            <List.Item>
              {assumptionsT("ownFeesOneTime", {
                value: formatCurrency(assumptions.ownFeesOneTime, currency, locale),
              })}
            </List.Item>
            <List.Item>
              {assumptionsT("ownHoldingCost", {
                value: formatCurrency(
                  assumptions.ownHoldingCostMonthly,
                  currency,
                  locale
                ),
                suffix: assumptionsT("perMonthSuffix"),
              })}
            </List.Item>
            <List.Item>
              {assumptionsT("holdingCostGrowth", {
                value: formatPct(assumptions.holdingCostAnnualGrowthPct),
              })}
            </List.Item>
          </List>
        </Stack>
      </Stack>
    </Card>
  );
}
