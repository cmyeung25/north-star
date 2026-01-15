import { Badge, Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
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
  locale,
  t,
  common,
}: {
  label: string;
  kpis: Kpis;
  currency: string;
  locale: string;
  t: (key: string) => string;
  common: (key: string) => string;
}) => (
  <Card withBorder radius="md" shadow="sm" padding="md">
    <Stack gap="sm">
      <Title order={5}>{label}</Title>
      <Stack gap={6}>
        <Text size="sm" c="dimmed">
          {t("kpiLowestBalance")}
        </Text>
        <Text fw={600}>
          {formatCurrency(kpis.lowestMonthlyBalance, currency, locale)}
        </Text>
        <Text size="sm" c="dimmed">
          {t("kpiRunway")}
        </Text>
        <Text fw={600}>{kpis.runwayMonths}</Text>
        <Text size="sm" c="dimmed">
          {t("kpiNetWorth")}
        </Text>
        <Text fw={600}>{formatCurrency(kpis.netWorthYear5, currency, locale)}</Text>
        <Text size="sm" c="dimmed">
          {t("kpiRisk")}
        </Text>
        <Badge color={riskColorMap[kpis.riskLevel]} variant="light">
          {common(`risk${kpis.riskLevel}`)}
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
  const t = useTranslations("stress");
  const common = useTranslations("common");
  const locale = useLocale();
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      <KpiCard
        label={t("beforeLabel")}
        kpis={baseline}
        currency={currency}
        locale={locale}
        t={t}
        common={common}
      />
      <KpiCard
        label={t("afterLabel")}
        kpis={stressed}
        currency={currency}
        locale={locale}
        t={t}
        common={common}
      />
    </SimpleGrid>
  );
}
