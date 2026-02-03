"use client";

import React from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import type { ScenarioEvent } from "../../domain/scenarioV2/events";
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
  onEditEvent,
  onDuplicateEvent,
  onDeleteEvent,
  onAdjustEvent,
}: EventCardListProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const [expandedEventIds, setExpandedEventIds] = useState<string[]>([]);
  const [showAllLedgerEventIds, setShowAllLedgerEventIds] = useState<string[]>([]);

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

        return (
          <Card key={event.id} withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Stack gap={2}>
                  <Text fw={600}>{event.label ?? t("ledgerRowFallbackLabel")}</Text>
                  <Text size="sm" c="dimmed">
                    {t("eventCardCadence", { cadence: cadenceLabel })}
                  </Text>
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
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => onDuplicateEvent(event.id)}
                  >
                    {common("actionDuplicate")}
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    onClick={() => onDeleteEvent(event.id)}
                  >
                    {common("actionDelete")}
                  </Button>
                  <Button
                    display={"none"}
                    size="xs"
                    variant="subtle"
                    onClick={() => primaryRow && onAdjustEvent(primaryRow)}
                    disabled={!primaryRow}
                  >
                    {common("actionAdjust")}
                  </Button>
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
