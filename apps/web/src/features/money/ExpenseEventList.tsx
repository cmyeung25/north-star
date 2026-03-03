"use client";

import { ActionIcon, Button, Card, Group, Menu, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import type { LedgerRow } from "../../engine/scenarioV2Compiler";
import { compareMonthKey } from "../../utils/monthKey";
import { formatCurrency } from "../../../lib/i18n";
import {
  resolveEventCardAmount,
  resolveEventCardEndMonth,
  resolveEventCardStartMonth,
  resolveEventMonthlyImpact,
} from "./eventCardUtils";
import { groupEventSeries } from "./eventSeriesGrouping";
import MoneyMetaTags from "./MoneyMetaTags";
import { resolveEventCategoryKey } from "./categoryMeta";
import { buildMoneyMetaTagViewModel } from "./moneyMetaTagViewModel";
import type { EventAdjustmentSpec } from "./adjustments/createEventAdjustment";

type Props = {
  events: ScenarioEvent[];
  ledgerRowsByEventId: Map<string, LedgerRow[]>;
  baseCurrency: string;
  locale: string;
  onEditEvent: (eventId: string) => void;
  onDuplicateEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onCreateEventAdjustment: (baseEvent: ScenarioEvent, spec: EventAdjustmentSpec) => void;
  anchorMonth?: string | null;
};

export default function ExpenseEventList({
  events,
  ledgerRowsByEventId,
  baseCurrency,
  locale,
  onEditEvent,
  onDuplicateEvent,
  onDeleteEvent,
  onCreateEventAdjustment,
  anchorMonth,
}: Props) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const groupedEvents = useMemo(() => groupEventSeries(events), [events]);

  if (events.length === 0) {
    return <Text size="sm" c="dimmed">{t("eventCardsEmpty")}</Text>;
  }

  return (
    <Stack gap="sm">
      {groupedEvents.map(({ baseEvent, adjustments, groupStartMonth, groupEndMonth }) => {
        const groupRows = [baseEvent, ...adjustments]
          .flatMap((event) => ledgerRowsByEventId.get(event.id) ?? [])
          .sort((left, right) => compareMonthKey(right.month, left.month));
        const projectionRow =
          groupRows.find((row) => (anchorMonth ? row.month === anchorMonth : false)) ??
          groupRows.find((row) => (anchorMonth ? compareMonthKey(row.month, anchorMonth) <= 0 : false)) ??
          groupRows[0];
        const amount = resolveEventCardAmount(baseEvent);
        const primaryAmount = Math.abs(amount ?? 0);
        const startMonth = resolveEventCardStartMonth(baseEvent);
        const endMonth = resolveEventCardEndMonth(baseEvent);
        const impact = resolveEventMonthlyImpact(groupRows);
        const expanded = Boolean(expandedIds[baseEvent.id]);
        const latestAdjustment = adjustments[adjustments.length - 1];

        return (
          <Card key={baseEvent.id} withBorder radius="md" padding="md">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Stack gap={4}>
                <Text fw={600}>{baseEvent.label ?? t("ledgerRowFallbackLabel")}</Text>
                <Text fw={700}>{formatCurrency(primaryAmount, baseCurrency, locale)}</Text>
                {impact ? (
                  <>
                    <Text size="sm" c="dimmed">
                      {t("eventCardMonthlyExpense", {
                        amount: formatCurrency(impact.expense, baseCurrency, locale),
                      })}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {t("eventCardMonthlyNet", {
                        amount: formatCurrency(impact.net, baseCurrency, locale),
                      })}
                    </Text>
                  </>
                ) : (
                  <Text size="sm" c="dimmed">
                    {t("eventCardMonthlyNet", {
                      amount:
                        amount !== null
                          ? formatCurrency(amount, baseCurrency, locale)
                          : t("amountUnset"),
                    })}
                  </Text>
                )}
                <Text size="sm" c="dimmed">
                  {t("eventCardMonths", {
                    startMonth: adjustments.length > 0 ? (groupStartMonth ?? startMonth ?? t("amountUnset")) : (startMonth ?? t("amountUnset")),
                    endMonth: adjustments.length > 0 ? (groupEndMonth ?? endMonth ?? t("eventCardOpenEnded")) : (endMonth ?? t("eventCardOpenEnded")),
                  })}
                </Text>
                <MoneyMetaTags
                  tags={buildMoneyMetaTagViewModel(baseEvent, {
                    householdLabel: t("householdLabel"),
                    ownerId: baseEvent.memberId,
                    resolveTypeLabel: () => {
                      if (baseEvent.type === "housing") {
                        return baseEvent.kind === "rent" ? t("eventTypeRent") : t("eventTypeMortgage");
                      }
                      if (baseEvent.type === "loan") {
                        return t("eventTypeLoan");
                      }
                      if (baseEvent.type === "insurance") {
                        return t("eventTypeInsurance");
                      }
                      return t("eventTypeExpense");
                    },
                    resolveFrequencyLabel: (meta) =>
                      meta.frequency === "none"
                        ? null
                        : t(
                            meta.frequency === "monthly"
                              ? "ledgerEventCadenceMonthly"
                              : meta.frequency === "yearly"
                                ? "ledgerEventCadenceYearly"
                                : meta.frequency === "oneOff"
                                  ? "ledgerEventCadenceOneOff"
                                  : meta.frequency === "quarterly"
                                    ? "ledgerEventCadenceQuarterly"
                                    : "ledgerEventCadenceEveryN"
                          ),
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
                            return categoryKey ? t(`expenseCategory.${categoryKey}`) : null;
                          })()
                        : null,
                    adjustmentCount: adjustments.length,
                    adjustmentLabel: t("eventAdjustmentCountBadge", { count: adjustments.length }),
                    projectionLabel: projectionRow
                      ? t("incomeProjectedPreview", {
                          month: projectionRow.month,
                          amount: formatCurrency(Math.abs(projectionRow.amount), baseCurrency, locale),
                        })
                      : null,
                  }).tags}
                />
                {adjustments.length > 0 && latestAdjustment && (
                  <Stack gap={4} mt={4}>
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>
                        調整 {adjustments.length} 次 · 最新：{resolveEventCardStartMonth(latestAdjustment) ?? "--"} {formatCurrency(Math.abs(resolveEventCardAmount(latestAdjustment) ?? 0), baseCurrency, locale)}
                      </Text>
                      <Button size="xs" variant="subtle" onClick={() => setExpandedIds((current) => ({ ...current, [baseEvent.id]: !expanded }))}>
                        {expanded ? "收起" : "展開"}
                      </Button>
                    </Group>
                    {expanded && adjustments.map((event) => (
                      <Group key={event.id} justify="space-between" wrap="nowrap">
                        <Text size="sm" c="dimmed">
                          {resolveEventCardStartMonth(event) ?? "--"} → {resolveEventCardEndMonth(event) ?? t("eventCardOpenEnded")} · {formatCurrency(Math.abs(resolveEventCardAmount(event) ?? 0), baseCurrency, locale)}
                        </Text>
                        <Group gap={4}>
                          <Button size="xs" variant="subtle" onClick={() => onEditEvent(event.id)}>{common("actionEdit")}</Button>
                          <Button size="xs" variant="subtle" color="red" onClick={() => onDeleteEvent(event.id)}>{common("actionDelete")}</Button>
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                )}
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
