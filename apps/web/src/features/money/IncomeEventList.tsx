"use client";

import { ActionIcon, Badge, Button, Card, Group, Menu, Select, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import type { LedgerRow } from "../../engine/scenarioV2Compiler";
import { formatCurrency } from "../../../lib/i18n";
import { resolveEventCardEndMonth, resolveEventCardStartMonth } from "./eventCardUtils";
import { groupIncomeEvents, type IncomeSortOption } from "./incomeViewModels";

type Props = {
  events: ScenarioEvent[];
  ledgerRowsByEventId: Map<string, LedgerRow[]>;
  baseCurrency: string;
  locale: string;
  incomeGrowthPct?: number | null;
  memberLookupRecord: Record<string, string>;
  sortBy: IncomeSortOption;
  onSortByChange: (value: IncomeSortOption) => void;
  onEditEvent: (eventId: string) => void;
  onDuplicateEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onAdjustEvent: (row: LedgerRow) => void;
  onCreateSalaryAdjustment?: (eventId: string) => void;
};

const isSalaryBase = (event: ScenarioEvent) =>
  event.type === "cashflow" && event.kind === "income" && event.cadence === "monthly";

export default function IncomeEventList({
  events,
  ledgerRowsByEventId,
  baseCurrency,
  locale,
  incomeGrowthPct,
  memberLookupRecord,
  sortBy,
  onSortByChange,
  onEditEvent,
  onDuplicateEvent,
  onDeleteEvent,
  onAdjustEvent,
  onCreateSalaryAdjustment,
}: Props) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const formattedIncomeGrowthPct = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(incomeGrowthPct ?? 0),
    [incomeGrowthPct, locale]
  );
  const groupedEvents = useMemo(() => groupIncomeEvents(events), [events]);

  if (events.length === 0) {
    return <Text size="sm" c="dimmed">{t("eventCardsEmpty")}</Text>;
  }

  return (
    <Stack gap="sm">
      <Group justify="flex-end">
        <Select
          size="xs"
          w={220}
          value={sortBy}
          onChange={(value) => value && onSortByChange(value as IncomeSortOption)}
          data={[
            { value: "amountDesc", label: t("incomeSortAmountDesc") },
            { value: "startMonthAsc", label: t("incomeSortStartMonthAsc") },
            { value: "endMonthAsc", label: t("incomeSortEndMonthAsc") },
          ]}
        />
      </Group>
      {groupedEvents.map(({ baseEvent, adjustments, groupStartMonth, groupEndMonth }) => {
        const rows = ledgerRowsByEventId.get(baseEvent.id) ?? [];
        const projectionRow = rows[0];
        const primaryAmount = projectionRow
          ? Math.abs(projectionRow.amount)
          : baseEvent.type === "cashflow"
            ? Math.abs(baseEvent.amount)
            : 0;
        const startMonth = resolveEventCardStartMonth(baseEvent);
        const endMonth = resolveEventCardEndMonth(baseEvent);
        const growthLabel =
          baseEvent.type === "cashflow" && baseEvent.kind === "income"
            ? baseEvent.growthMode === "assumption"
              ? t("eventCardIncomeGrowth", { pct: formattedIncomeGrowthPct })
              : baseEvent.growthMode === "custom"
                ? t("eventCardIncomeGrowthCustom", { pct: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(baseEvent.customGrowthRatePct ?? 0) })
                : t("incomeGrowthNone")
            : null;
        const frequencyLabel =
          baseEvent.type === "cashflow"
            ? t(
                baseEvent.cadence === "monthly"
                  ? "ledgerEventCadenceMonthly"
                  : baseEvent.cadence === "yearly"
                    ? "ledgerEventCadenceYearly"
                    : baseEvent.cadence === "oneOff"
                      ? "ledgerEventCadenceOneOff"
                      : baseEvent.cadence === "quarterly"
                        ? "ledgerEventCadenceQuarterly"
                        : "ledgerEventCadenceEveryN"
              )
            : t("ledgerEventCadenceOneOff");
        return (
          <Card key={baseEvent.id} withBorder radius="md" padding="md">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Stack gap={4}>
                <Text fw={600}>{baseEvent.label ?? t("ledgerRowFallbackLabel")}</Text>
                <Text fw={700}>{formatCurrency(primaryAmount, baseCurrency, locale)}</Text>
                <Group gap={6}>
                  <Badge variant="light">{frequencyLabel}</Badge>
                  {baseEvent.memberId && <Badge variant="outline">{memberLookupRecord[baseEvent.memberId] ?? t("householdLabel")}</Badge>}
                  {adjustments.length > 0 && (
                    <Badge variant="outline" color="blue">調整 {adjustments.length} 次</Badge>
                  )}
                </Group>
                {growthLabel && <Text size="sm" c="dimmed">{growthLabel}</Text>}
                {isSalaryBase(baseEvent) && adjustments.length > 0 ? (
                  <Text size="sm" c="dimmed">
                    {t("eventCardMonths", {
                      startMonth: groupStartMonth ?? startMonth ?? t("amountUnset"),
                      endMonth: groupEndMonth ?? endMonth ?? t("eventCardOpenEnded"),
                    })}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    {t("eventCardMonths", {
                      startMonth: startMonth ?? t("amountUnset"),
                      endMonth: endMonth ?? t("eventCardOpenEnded"),
                    })}
                  </Text>
                )}
                {projectionRow && (
                  <Text size="xs" c="dimmed">
                    {t("incomeProjectedPreview", {
                      month: projectionRow.month,
                      amount: formatCurrency(Math.abs(projectionRow.amount), baseCurrency, locale),
                    })}
                  </Text>
                )}
                {adjustments.length > 0 && (
                  <Stack gap={4} mt={4}>
                    <Text size="sm" fw={600}>調整後</Text>
                    {adjustments.map((adjustment) => (
                      <Group key={adjustment.id} justify="space-between" wrap="nowrap">
                        <Text size="sm" c="dimmed">
                          {(resolveEventCardStartMonth(adjustment) ?? "--")} 起 {formatCurrency(Math.abs(adjustment.type === "cashflow" ? adjustment.amount : 0), baseCurrency, locale)}
                        </Text>
                        <Group gap={4}>
                          <Button size="xs" variant="subtle" onClick={() => onEditEvent(adjustment.id)}>{common("actionEdit")}</Button>
                          <Button size="xs" variant="subtle" color="red" onClick={() => onDeleteEvent(adjustment.id)}>{common("actionDelete")}</Button>
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Stack>
              <Group gap="xs">
                {isSalaryBase(baseEvent) && onCreateSalaryAdjustment && (
                  <Button size="xs" variant="light" onClick={() => onCreateSalaryAdjustment(baseEvent.id)}>
                    新增調整
                  </Button>
                )}
                <Button size="xs" variant="light" onClick={() => onEditEvent(baseEvent.id)}>{common("actionEdit")}</Button>
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon variant="subtle" size="sm" aria-label={common("actionMore")}>⋯</ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item onClick={() => onDuplicateEvent(baseEvent.id)}>{common("actionDuplicate")}</Menu.Item>
                    <Menu.Item disabled={!projectionRow} onClick={() => projectionRow && onAdjustEvent(projectionRow)}>{common("actionAdjust")}</Menu.Item>
                    <Menu.Item color="red" onClick={() => onDeleteEvent(baseEvent.id)}>{common("actionDelete")}</Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
          </Card>
        );
      })}
    </Stack>
  );
}
