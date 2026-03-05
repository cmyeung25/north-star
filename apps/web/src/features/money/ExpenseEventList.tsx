"use client";

import React from "react";
import { ActionIcon, Button, Group, Menu, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import type { LedgerRow } from "../../engine/scenarioV2Compiler";
import { formatCurrency } from "../../../lib/i18n";
import {
  resolveAdjustmentSummary,
  resolveDisplayMonths,
  resolveEventCardAmount,
  resolveEventCardEndMonth,
  resolveEventCardStartMonth,
  resolveProjectionPreviewRow,
} from "./eventCardUtils";
import { groupEventSeries } from "./eventSeriesGrouping";
import MoneyMetaTags from "./MoneyMetaTags";
import { resolveEventCategoryKey } from "./categoryMeta";
import { buildMoneyMetaTagViewModel } from "./moneyMetaTagViewModel";
import type { EventAdjustmentSpec } from "./adjustments/createEventAdjustment";
import MoneyEventCard from "./MoneyEventCard";

type Props = {
  events: ScenarioEvent[];
  ledgerRowsByEventId: Map<string, LedgerRow[]>;
  baseCurrency: string;
  locale: string;
  memberLookupRecord?: Record<string, string>;
  onEditEvent: (eventId: string) => void;
  onDuplicateEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onCreateEventAdjustment: (baseEvent: ScenarioEvent, spec: EventAdjustmentSpec) => void;
  anchorMonth?: string | null;
  milestoneGeneratedSourceByEventId?: Map<string, string>;
};

export default function ExpenseEventList({
  events,
  ledgerRowsByEventId,
  baseCurrency,
  locale,
  memberLookupRecord = {},
  onEditEvent,
  onDuplicateEvent,
  onDeleteEvent,
  onCreateEventAdjustment,
  anchorMonth,
  milestoneGeneratedSourceByEventId,
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
        const groupRows = [baseEvent, ...adjustments].flatMap((event) => ledgerRowsByEventId.get(event.id) ?? []);
        const projectionRow = resolveProjectionPreviewRow(groupRows, anchorMonth);
        const amount = resolveEventCardAmount(baseEvent);
        const primaryAmount = Math.abs(amount ?? 0);
        const startMonth = resolveEventCardStartMonth(baseEvent);
        const endMonth = resolveEventCardEndMonth(baseEvent);
        const displayMonths = resolveDisplayMonths({
          startMonth,
          endMonth,
          groupStartMonth,
          groupEndMonth,
          hasAdjustments: adjustments.length > 0,
        });
        const expanded = Boolean(expandedIds[baseEvent.id]);
        const adjustmentSummary = resolveAdjustmentSummary({
          adjustments,
          resolveAmount: (event) => resolveEventCardAmount(event) ?? 0,
        });

        return (
          <MoneyEventCard
            key={baseEvent.id}
            title={baseEvent.label ?? t("ledgerRowFallbackLabel")}
            primaryAmount={formatCurrency(primaryAmount, baseCurrency, locale)}
            metaTags={
              <MoneyMetaTags
                tags={buildMoneyMetaTagViewModel(baseEvent, {
                  householdLabel: t("householdLabel"),
                  ownerId: baseEvent.memberId,
                  memberLookupRecord,
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
                  sourceLabel: milestoneGeneratedSourceByEventId?.get(baseEvent.id)
                    ? t("eventGeneratedBadge")
                    : null,
                  attributeLabel: milestoneGeneratedSourceByEventId?.get(baseEvent.id) ?? null,
                }).tags}
              />
            }
            monthRange={
              <Text size="sm" c="dimmed">
                {t("eventCardMonths", {
                  startMonth: displayMonths.startMonth ?? t("amountUnset"),
                  endMonth: displayMonths.endMonth ?? t("eventCardOpenEnded"),
                })}
              </Text>
            }
            projectionSummary={
              projectionRow ? (
                <Text size="xs" c="dimmed">
                  {t("incomeProjectedPreview", {
                    month: projectionRow.month,
                    amount: formatCurrency(Math.abs(projectionRow.amount), baseCurrency, locale),
                  })}
                </Text>
              ) : null
            }
            adjustmentSummary={
              adjustmentSummary ? (
                <Stack gap={4} mt={4}>
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>
                      {t("eventAdjustmentLatestSummary", {
                        count: adjustmentSummary.count,
                        month: adjustmentSummary.month ?? t("eventAdjustmentUnknownMonth"),
                        amount: formatCurrency(adjustmentSummary.amount, baseCurrency, locale),
                      })}
                    </Text>
                    <Button size="xs" variant="subtle" onClick={() => setExpandedIds((current) => ({ ...current, [baseEvent.id]: !expanded }))}>
                      {expanded ? t("eventAdjustmentCollapse") : t("eventAdjustmentExpand")}
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
              ) : null
            }
            actions={
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
                      {t("eventAdjustmentAdd")}
                    </Menu.Item>
                    <Menu.Item color="red" onClick={() => onDeleteEvent(baseEvent.id)}>{common("actionDelete")}</Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            }
          />
        );
      })}
    </Stack>
  );
}
