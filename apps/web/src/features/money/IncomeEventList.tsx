"use client";

import { ActionIcon, Badge, Button, Card, Group, Menu, Select, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import type { LedgerRow } from "../../engine/scenarioV2Compiler";
import { formatCurrency } from "../../../lib/i18n";
import { resolveEventCardEndMonth, resolveEventCardStartMonth } from "./eventCardUtils";
import type { IncomeSortOption } from "./incomeViewModels";

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
};

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
}: Props) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const formattedIncomeGrowthPct = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(incomeGrowthPct ?? 0),
    [incomeGrowthPct, locale]
  );

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
      {events.map((event) => {
        const primaryAmount = event.type === "cashflow" ? event.amount : 0;
        const rows = ledgerRowsByEventId.get(event.id) ?? [];
        const projectionRow = rows[0];
        const startMonth = resolveEventCardStartMonth(event);
        const endMonth = resolveEventCardEndMonth(event);
        const growthLabel =
          event.type === "cashflow" && event.kind === "income"
            ? event.growthMode === "assumption"
              ? t("eventCardIncomeGrowth", { pct: formattedIncomeGrowthPct })
              : event.growthMode === "custom"
                ? t("eventCardIncomeGrowthCustom", { pct: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(event.customGrowthRatePct ?? 0) })
                : t("incomeGrowthNone")
            : null;
        const frequencyLabel =
          event.type === "cashflow"
            ? t(
                event.cadence === "monthly"
                  ? "ledgerEventCadenceMonthly"
                  : event.cadence === "yearly"
                    ? "ledgerEventCadenceYearly"
                    : event.cadence === "oneOff"
                      ? "ledgerEventCadenceOneOff"
                      : event.cadence === "quarterly"
                        ? "ledgerEventCadenceQuarterly"
                        : "ledgerEventCadenceEveryN"
              )
            : t("ledgerEventCadenceOneOff");
        return (
          <Card key={event.id} withBorder radius="md" padding="md">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Stack gap={4}>
                <Text fw={600}>{event.label ?? t("ledgerRowFallbackLabel")}</Text>
                <Text fw={700}>{formatCurrency(primaryAmount, baseCurrency, locale)}</Text>
                <Group gap={6}>
                  <Badge variant="light">{frequencyLabel}</Badge>
                  {event.memberId && <Badge variant="outline">{memberLookupRecord[event.memberId] ?? t("householdLabel")}</Badge>}
                </Group>
                {growthLabel && <Text size="sm" c="dimmed">{growthLabel}</Text>}
                <Text size="sm" c="dimmed">
                  {t("eventCardMonths", {
                    startMonth: startMonth ?? t("amountUnset"),
                    endMonth: endMonth ?? t("eventCardOpenEnded"),
                  })}
                </Text>
                {projectionRow && (
                  <Text size="xs" c="dimmed">
                    {t("incomeProjectedPreview", {
                      month: projectionRow.month,
                      amount: formatCurrency(Math.abs(projectionRow.amount), baseCurrency, locale),
                    })}
                  </Text>
                )}
              </Stack>
              <Group gap="xs">
                <Button size="xs" variant="light" onClick={() => onEditEvent(event.id)}>{common("actionEdit")}</Button>
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon variant="subtle" size="sm" aria-label={common("actionMore")}>⋯</ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item onClick={() => onDuplicateEvent(event.id)}>{common("actionDuplicate")}</Menu.Item>
                    <Menu.Item disabled={!projectionRow} onClick={() => projectionRow && onAdjustEvent(projectionRow)}>{common("actionAdjust")}</Menu.Item>
                    <Menu.Item color="red" onClick={() => onDeleteEvent(event.id)}>{common("actionDelete")}</Menu.Item>
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
