"use client";

import React from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Stack,
  Text,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import { getDefaultCashflowGrowthMode } from "../../domain/scenarioV2/growthPolicy";
import type { LedgerRow } from "../../engine/scenarioV2Compiler";
import { formatCurrency } from "../../../lib/i18n";
import {
  resolveEventCardAmount,
  resolveEventCardEndMonth,
  resolveEventCardStartMonth,
  resolveEventMonthlyImpact,
} from "./eventCardUtils";

type EventCardListProps = {
  events: ScenarioEvent[];
  ledgerRowsByEventId: Map<string, LedgerRow[]>;
  baseCurrency: string;
  locale: string;
  incomeGrowthPct?: number | null;
  onEditEvent: (eventId: string) => void;
  onDuplicateEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onAdjustEvent: (row: LedgerRow) => void;
};

const ledgerPreviewLimit = 24;

export default function EventCardList({
  events,
  ledgerRowsByEventId,
  baseCurrency,
  locale,
  incomeGrowthPct,
  onEditEvent,
  onDuplicateEvent,
  onDeleteEvent,
  onAdjustEvent,
}: EventCardListProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const [expandedEventIds, setExpandedEventIds] = useState<string[]>([]);
  const [showAllLedgerEventIds, setShowAllLedgerEventIds] = useState<string[]>([]);
  const formattedIncomeGrowthPct = useMemo(() => {
    if (!Number.isFinite(incomeGrowthPct ?? NaN)) {
      return "0";
    }
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
      incomeGrowthPct ?? 0
    );
  }, [incomeGrowthPct, locale]);
  const formatGrowthPct = useCallback(
    (value: number | null | undefined) => {
      if (!Number.isFinite(value ?? NaN)) {
        return "0";
      }
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
        value ?? 0
      );
    },
    [locale]
  );

  const resolveEventCadenceLabel = useCallback(
    (event: ScenarioEvent) => {
      if (event.type === "cashflow") {
        switch (event.cadence) {
          case "monthly":
            return t("ledgerEventCadenceMonthly");
          case "quarterly":
            return t("ledgerEventCadenceQuarterly");
          case "yearly":
            return t("ledgerEventCadenceYearly");
          case "everyNMonths":
            return t("ledgerEventCadenceEveryN");
          case "oneOff":
            return t("ledgerEventCadenceOneOff");
          default:
            return t("ledgerEventCadenceMonthly");
        }
      }
      if (event.type === "adjustment") {
        return t("ledgerEventCadenceOneOff");
      }
      return t("ledgerEventCadenceMonthly");
    },
    [t]
  );

  const toggleEventExpanded = useCallback((eventId: string) => {
    setExpandedEventIds((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId]
    );
  }, []);

  const toggleShowAllRows = useCallback((eventId: string) => {
    setShowAllLedgerEventIds((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId]
    );
  }, []);

  if (events.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t("eventCardsEmpty")}
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {events.map((event) => {
        const rows = ledgerRowsByEventId.get(event.id) ?? [];
        const amount = resolveEventCardAmount(event);
        const startMonth = resolveEventCardStartMonth(event);
        const endMonth = resolveEventCardEndMonth(event);
        const cadenceLabel = resolveEventCadenceLabel(event);
        const expanded = expandedEventIds.includes(event.id);
        const showAll = showAllLedgerEventIds.includes(event.id);
        const displayRows = showAll ? rows : rows.slice(0, ledgerPreviewLimit);
        const hasMoreRows = rows.length > ledgerPreviewLimit;
        const primaryRow = rows[0];
        const impact = resolveEventMonthlyImpact(rows);
        const hasIncomeImpact = Boolean(impact && impact.income > 0);
        const hasExpenseImpact = Boolean(impact && impact.expense > 0);
        const resolvedGrowthMode =
          event.type === "cashflow"
            ? event.growthMode ?? getDefaultCashflowGrowthMode(event)
            : undefined;
        const showIncomeGrowthAssumption =
          event.type === "cashflow" &&
          event.kind === "income" &&
          resolvedGrowthMode === "assumption";
        const showIncomeGrowthCustom =
          event.type === "cashflow" &&
          event.kind === "income" &&
          resolvedGrowthMode === "custom";

        return (
          <Card key={event.id} withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Stack gap={2}>
                  <Text fw={600}>{event.label ?? t("ledgerRowFallbackLabel")}</Text>
                  <Text size="sm" c="dimmed">
                    {t("eventCardCadence", { cadence: cadenceLabel })}
                  </Text>
                  {showIncomeGrowthAssumption && (
                    <Text size="sm" c="dimmed">
                      {t("eventCardIncomeGrowth", { pct: formattedIncomeGrowthPct })}
                    </Text>
                  )}
                  {showIncomeGrowthCustom && (
                    <Text size="sm" c="dimmed">
                      {t("eventCardIncomeGrowthCustom", {
                        pct: formatGrowthPct(event.customGrowthRatePct),
                      })}
                    </Text>
                  )}
                  {impact ? (
                    <>
                      {hasIncomeImpact && (
                        <Text size="sm" c="dimmed">
                          {t("eventCardMonthlyIncome", {
                            amount: formatCurrency(impact.income, baseCurrency, locale),
                          })}
                        </Text>
                      )}
                      {hasExpenseImpact && (
                        <Text size="sm" c="dimmed">
                          {t("eventCardMonthlyExpense", {
                            amount: formatCurrency(impact.expense, baseCurrency, locale),
                          })}
                        </Text>
                      )}
                      <Text size="sm" c="dimmed">
                        {t("eventCardMonthlyNet", {
                          amount:
                            hasIncomeImpact || hasExpenseImpact
                              ? formatCurrency(impact.net, baseCurrency, locale)
                              : t("amountUnset"),
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
                      startMonth: startMonth ?? t("amountUnset"),
                      endMonth: endMonth ?? t("eventCardOpenEnded"),
                    })}
                  </Text>
                </Stack>
                <Group gap="xs">
                  <Button size="xs" variant="light" onClick={() => onEditEvent(event.id)}>
                    {common("actionEdit")}
                  </Button>
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" size="sm" aria-label={common("actionMore")}>
                        ⋯
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item onClick={() => onDuplicateEvent(event.id)}>
                        {common("actionDuplicate")}
                      </Menu.Item>
                      <Menu.Item
                        disabled={!primaryRow}
                        onClick={() => primaryRow && onAdjustEvent(primaryRow)}
                      >
                        {common("actionAdjust")}
                      </Menu.Item>
                      <Menu.Item color="red" onClick={() => onDeleteEvent(event.id)}>
                        {common("actionDelete")}
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Group>

              <Button
                size="xs"
                variant="subtle"
                onClick={() => toggleEventExpanded(event.id)}
              >
                {expanded
                  ? t("eventCardCollapseLedger")
                  : t("eventCardExpandLedger")}
              </Button>

              {expanded && (
                <Stack gap="xs">
                  {displayRows.map((row, index) => (
                    <Group
                      key={`${row.sourceEventId}-${index}`}
                      justify="space-between"
                      wrap="nowrap"
                    >
                      <Group gap="xs" wrap="nowrap">
                        <Badge variant="light">
                          {row.kind === "income"
                            ? t("incomeTitle")
                            : row.kind === "expense"
                              ? t("expensesTitle")
                              : row.amount >= 0
                                ? t("incomeTitle")
                                : t("expensesTitle")}
                        </Badge>
                        <Text size="sm">{row.month}</Text>
                        <Text size="sm" lineClamp={1}>
                          {row.label ?? t("ledgerRowFallbackLabel")}
                        </Text>
                      </Group>
                      <Text size="sm" fw={500}>
                        {formatCurrency(row.amount, baseCurrency, locale)}
                      </Text>
                    </Group>
                  ))}
                  {hasMoreRows && (
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => toggleShowAllRows(event.id)}
                    >
                      {showAll ? t("eventCardShowLess") : t("eventCardShowMore")}
                    </Button>
                  )}
                </Stack>
              )}
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
