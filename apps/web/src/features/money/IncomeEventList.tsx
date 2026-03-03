"use client";

import { ActionIcon, Button, Card, Group, Menu, Select, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import { getDefaultCashflowGrowthMode } from "../../domain/scenarioV2/growthPolicy";
import type { LedgerRow } from "../../engine/scenarioV2Compiler";
import { formatCurrency } from "../../../lib/i18n";
import { resolveEventCardAmount, resolveEventCardEndMonth, resolveEventCardStartMonth } from "./eventCardUtils";
import MoneyMetaTags from "./MoneyMetaTags";
import { resolveEventCategoryKey } from "./categoryMeta";
import { buildMoneyMetaTagViewModel } from "./moneyMetaTagViewModel";
import { compareMonthKey } from "../../utils/monthKey";
import { groupIncomeEvents, type IncomeSortOption } from "./incomeViewModels";
import { computeEffectiveRanges } from "./salaryAdjustmentGrouping";
import { type EventAdjustmentSpec } from "./adjustments/createEventAdjustment";

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
  onCreateEventAdjustment: (baseEvent: ScenarioEvent, spec: EventAdjustmentSpec) => void;
  anchorMonth?: string | null;
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
  onCreateEventAdjustment,
  anchorMonth,
}: Props) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const formattedIncomeGrowthPct = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(incomeGrowthPct ?? 0),
    [incomeGrowthPct, locale]
  );
  const groupedEvents = useMemo(() => groupIncomeEvents(events), [events]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

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
        const groupRows = [baseEvent, ...adjustments]
          .flatMap((event) => ledgerRowsByEventId.get(event.id) ?? [])
          .sort((left, right) => compareMonthKey(left.month, right.month));
        const projectionRow =
          groupRows.find((row) => (anchorMonth ? row.month === anchorMonth : false)) ??
          groupRows.find((row) => (anchorMonth ? compareMonthKey(row.month, anchorMonth) <= 0 : false)) ??
          groupRows[0];
        const primaryAmount = projectionRow
          ? Math.abs(projectionRow.amount)
          : Math.abs(resolveEventCardAmount(baseEvent) ?? 0);
        const startMonth = resolveEventCardStartMonth(baseEvent);
        const endMonth = resolveEventCardEndMonth(baseEvent);
        const baseGrowthMode =
          baseEvent.type === "cashflow"
            ? baseEvent.growthMode ?? getDefaultCashflowGrowthMode(baseEvent)
            : undefined;
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
                <MoneyMetaTags
                  tags={buildMoneyMetaTagViewModel(baseEvent, {
                    householdLabel: t("householdLabel"),
                    ownerId: baseEvent.memberId,
                    memberLookupRecord,
                    resolveTypeLabel: (meta) =>
                      meta.type === "cashflow" && meta.kind === "income"
                        ? t("eventTypeIncome")
                        : t("eventTypeExpense"),
                    resolveFrequencyLabel: () => frequencyLabel,
                    resolveLifecycleLabel: (meta) =>
                      meta.lifecycle === "oneOff"
                        ? t("ledgerEventCadenceOneOff")
                        : meta.lifecycle === "hasEndMonth"
                          ? t("eventLifecycleHasEndMonth")
                          : t("eventCardOpenEnded"),
                    categoryLabel:
                      baseEvent.type === "cashflow"
                        ? (() => {
                            const categoryKey = resolveEventCategoryKey(baseEvent);
                            return categoryKey
                              ? baseEvent.kind === "income"
                                ? t(`incomeCategory.${categoryKey}`)
                                : t(`expenseCategory.${categoryKey}`)
                              : null;
                          })()
                        : null,
                    growthLabel:
                      baseEvent.type === "cashflow" && baseEvent.kind === "income"
                        ? baseGrowthMode === "assumption"
                          ? t("eventCardIncomeGrowthBadge", { pct: formattedIncomeGrowthPct })
                          : baseGrowthMode === "custom"
                            ? t("eventCardIncomeGrowthCustomBadge", {
                                pct: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(baseEvent.customGrowthRatePct ?? 0),
                              })
                            : t("incomeGrowthNone")
                        : null,
                    adjustmentCount: adjustments.length,
                    adjustmentLabel: t("eventAdjustmentCountBadge", { count: adjustments.length }),
                  }).tags}
                />
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
                {adjustments.length > 0 && (() => {
                  const latest = adjustments[adjustments.length - 1];
                  const ranges = computeEffectiveRanges(baseEvent, adjustments);
                  const expanded = Boolean(expandedIds[baseEvent.id]);
                  return (
                    <Stack gap={4} mt={4}>
                      <Group justify="space-between">
                        <Text size="sm" fw={600}>
                          調整 {adjustments.length} 次 · 最新：{resolveEventCardStartMonth(latest) ?? "--"} {formatCurrency(Math.abs(latest.type === "cashflow" ? latest.amount : 0), baseCurrency, locale)}
                        </Text>
                        <Button size="xs" variant="subtle" onClick={() => setExpandedIds((current) => ({ ...current, [baseEvent.id]: !expanded }))}>
                          {expanded ? "收起" : "展開"}
                        </Button>
                      </Group>
                      {expanded && ranges.slice(1).map((segment) => (
                        <Group key={segment.event.id} justify="space-between" wrap="nowrap">
                          <Text size="sm" c="dimmed">
                            {segment.from ?? "--"} → {segment.to ?? t("eventCardOpenEnded")} · {formatCurrency(Math.abs(segment.event.type === "cashflow" ? segment.event.amount : 0), baseCurrency, locale)}
                          </Text>
                          <Group gap={4}>
                            <Button size="xs" variant="subtle" onClick={() => onEditEvent(segment.event.id)}>{common("actionEdit")}</Button>
                            <Button size="xs" variant="subtle" color="red" onClick={() => onDeleteEvent(segment.event.id)}>{common("actionDelete")}</Button>
                          </Group>
                        </Group>
                      ))}
                    </Stack>
                  );
                })()}
              </Stack>
              <Group gap="xs">
                <Button size="xs" variant="light" onClick={() => onEditEvent(baseEvent.id)}>{common("actionEdit")}</Button>
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon variant="subtle" size="sm" aria-label={common("actionMore")}>⋯</ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item onClick={() => onDuplicateEvent(baseEvent.id)}>{common("actionDuplicate")}</Menu.Item>
                    <Menu.Item
                      disabled={!projectionRow}
                      onClick={() =>
                        projectionRow &&
                        onCreateEventAdjustment(baseEvent, {
                          mode: "override",
                          amount: projectionRow.amount,
                          effectiveMonth: projectionRow.month,
                          row: projectionRow,
                        })
                      }
                    >
                      新增調整
                    </Menu.Item>
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
