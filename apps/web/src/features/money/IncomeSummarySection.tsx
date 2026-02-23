"use client";

import { Card, Group, SegmentedControl, SimpleGrid, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { formatCurrency } from "../../../lib/i18n";
import type { IncomeStatusFilter } from "./incomeViewModels";
import StackedContributionBar from "./StackedContributionBar";
import type { ScenarioMember } from "../../store/scenarioStore";

type IncomeSummarySectionProps = {
  locale: string;
  currency: string;
  members: ScenarioMember[];
  selectedMemberId: string;
  selectedStatus: IncomeStatusFilter;
  onMemberChange: (value: string) => void;
  onStatusChange: (value: IncomeStatusFilter) => void;
  baselineMonthlyTotal: number;
  nonMonthlyIncomeTotal: number;
  sourceCount: number;
  memberCount: number;
  projectedDelta12m: number | null;
  expiringCount: number;
  topSources: Array<{ id: string; label: string; amount: number; share: number }>;
};

export default function IncomeSummarySection({
  locale,
  currency,
  members,
  selectedMemberId,
  selectedStatus,
  onMemberChange,
  onStatusChange,
  baselineMonthlyTotal,
  nonMonthlyIncomeTotal,
  sourceCount,
  memberCount,
  projectedDelta12m,
  expiringCount,
  topSources,
}: IncomeSummarySectionProps) {
  const t = useTranslations("money");

  const categoryTopSources = topSources.map((source) => ({
    ...source,
    label: t(`incomeCategory.${source.id}`),
  }));

  const memberData = [
    { value: "all", label: t("incomeFilterAll") },
    ...members.map((member) => ({ value: member.id, label: member.name })),
  ];

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder radius="md" padding="sm">
          <Text size="xs" c="dimmed">{t("incomeSummaryBaselineMonthly")}</Text>
          <Text fw={700}>{formatCurrency(baselineMonthlyTotal, currency, locale)}</Text>
          <Text size="xs" c="dimmed">{t("incomeSummaryNonMonthly", { amount: formatCurrency(nonMonthlyIncomeTotal, currency, locale) })}</Text>
        </Card>
        <Card withBorder radius="md" padding="sm">
          <Text size="xs" c="dimmed">{t("incomeSummarySources")}</Text>
          <Text fw={700}>{t("incomeSummarySourceValue", { events: sourceCount, members: memberCount })}</Text>
          <Text size="xs" c="dimmed">{t("incomeSummaryExpiring", { count: expiringCount })}</Text>
        </Card>
        <Card withBorder radius="md" padding="sm">
          <Text size="xs" c="dimmed">{t("incomeSummaryDelta12m")}</Text>
          <Text fw={700} c={projectedDelta12m !== null && projectedDelta12m < 0 ? "red" : undefined}>
            {projectedDelta12m === null
              ? t("amountUnset")
              : formatCurrency(projectedDelta12m, currency, locale)}
          </Text>
        </Card>
      </SimpleGrid>

      <Group grow display="none">
        <SegmentedControl data={memberData} value={selectedMemberId} onChange={onMemberChange} />
        <SegmentedControl
          data={[
            { value: "all", label: t("incomeStatusAll") },
            { value: "ongoing", label: t("incomeStatusOngoing") },
            { value: "ending", label: t("incomeStatusEnding") },
          ]}
          value={selectedStatus}
          onChange={(value) => onStatusChange(value as IncomeStatusFilter)}
        />
      </Group>

      <StackedContributionBar
        title={t("incomeTopSourcesTitle")}
        data={categoryTopSources}
        currency={currency}
        locale={locale}
      />
    </Stack>
  );
}
