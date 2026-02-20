"use client";

import { ActionIcon, Badge, Button, Card, Group, Menu, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import type { LedgerRow } from "../../engine/scenarioV2Compiler";
import { formatCurrency } from "../../../lib/i18n";
import {
  resolveEventCardAmount,
  resolveEventCardEndMonth,
  resolveEventCardStartMonth,
  resolveEventMonthlyImpact,
} from "./eventCardUtils";
import EventTypeBadge from "./EventTypeBadge";
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
}: Props) {
  const t = useTranslations("money");
  const common = useTranslations("common");

  if (events.length === 0) {
    return <Text size="sm" c="dimmed">{t("eventCardsEmpty")}</Text>;
  }

  return (
    <Stack gap="sm">
      {events.map((event) => {
        const rows = ledgerRowsByEventId.get(event.id) ?? [];
        const primaryRow = rows[0];
        const amount = resolveEventCardAmount(event);
        const startMonth = resolveEventCardStartMonth(event);
        const endMonth = resolveEventCardEndMonth(event);
        const impact = resolveEventMonthlyImpact(rows);
        return (
          <Card key={event.id} withBorder radius="md" padding="md">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Stack gap={4}>
                <Text fw={600}>{event.label ?? t("ledgerRowFallbackLabel")}</Text>
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
                    startMonth: startMonth ?? t("amountUnset"),
                    endMonth: endMonth ?? t("eventCardOpenEnded"),
                  })}
                </Text>
                <EventTypeBadge event={event} />
                {primaryRow && (
                  <Badge variant="light" color="red">
                    {t("incomeProjectedPreview", {
                      month: primaryRow.month,
                      amount: formatCurrency(Math.abs(primaryRow.amount), baseCurrency, locale),
                    })}
                  </Badge>
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
                    <Menu.Item
                      disabled={!primaryRow}
                      onClick={() =>
                        primaryRow &&
                        onCreateEventAdjustment(event, {
                          mode: "override",
                          amount: primaryRow.amount,
                          effectiveMonth: primaryRow.month,
                          row: primaryRow,
                        })
                      }
                    >
                      新增調整
                    </Menu.Item>
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
