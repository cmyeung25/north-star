"use client";

import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { formatCurrency } from "../../../lib/i18n";
import StackedContributionBar from "./StackedContributionBar";
import type { ContributionByEvent } from "./incomeViewModels";

type Props = {
  locale: string;
  currency: string;
  baselineMonthlyTotal: number;
  sourceCount: number;
  memberCount: number;
  projectedDelta12m: number | null;
  expiringCount: number;
  topSources: ContributionByEvent[];
};

export default function ExpenseSummarySection({
  locale,
  currency,
  baselineMonthlyTotal,
  sourceCount,
  memberCount,
  projectedDelta12m,
  expiringCount,
  topSources,
}: Props) {
  const t = useTranslations("money");

  const categoryTopSources = topSources.map((source) => ({
    ...source,
    label: t(`expenseCategory.${source.id}`),
  }));

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder radius="md" padding="sm">
          <Text size="xs" c="dimmed">{t("expenseSummaryBaselineMonthly")}</Text>
          <Text fw={700}>{formatCurrency(baselineMonthlyTotal, currency, locale)}</Text>
        </Card>
        <Card withBorder radius="md" padding="sm">
          <Text size="xs" c="dimmed">{t("expenseSummarySources")}</Text>
          <Text fw={700}>{t("incomeSummarySourceValue", { events: sourceCount, members: memberCount })}</Text>
          <Text size="xs" c="dimmed">{t("incomeSummaryExpiring", { count: expiringCount })}</Text>
        </Card>
        <Card withBorder radius="md" padding="sm">
          <Text size="xs" c="dimmed">{t("expenseSummaryDelta12m")}</Text>
          <Text fw={700} c={projectedDelta12m !== null && projectedDelta12m > 0 ? "red" : undefined}>
            {projectedDelta12m === null ? t("amountUnset") : formatCurrency(projectedDelta12m, currency, locale)}
          </Text>
        </Card>
      </SimpleGrid>
      <StackedContributionBar
        title={t("expenseTopSourcesTitle")}
        data={categoryTopSources}
        currency={currency}
        locale={locale}
      />
    </Stack>
  );
}
