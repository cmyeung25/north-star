"use client";

import React from "react";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { formatCurrency } from "../../lib/i18n";
import type { LedgerRow } from "../../src/engine/scenarioV2Compiler";
import type { ScenarioMember } from "../../src/store/scenarioStore";

export type MoneyLedgerViewProps = {
  rows: LedgerRow[];
  baseCurrency: string;
  locale: string;
  members: ScenarioMember[];
  onAddEvent?: () => void;
  onEditEvent: (eventId: string) => void;
  onDuplicateEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onAdjustEvent: (row: LedgerRow) => void;
  errorMessage?: string | null;
};

const resolveMemberLabel = (
  members: ScenarioMember[],
  memberId?: string
): string => {
  if (!memberId) {
    return "";
  }
  return members.find((member) => member.id === memberId)?.name ?? "";
};

export default function MoneyLedgerView({
  rows,
  baseCurrency,
  locale,
  members,
  onAddEvent,
  onEditEvent,
  onDuplicateEvent,
  onDeleteEvent,
  onAdjustEvent,
  errorMessage,
}: MoneyLedgerViewProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");

  const missingSource = rows.filter((row) => !row.sourceEventId);
  const validRows = rows.filter((row) => row.sourceEventId);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Text size="sm" c="dimmed">
          {t("ledgerHint")}
        </Text>
        {onAddEvent && (
          <Button size="xs" variant="light" onClick={onAddEvent}>
            {t("ledgerAddEvent")}
          </Button>
        )}
      </Group>

      {errorMessage && (
        <Text size="sm" c="red">
          {errorMessage}
        </Text>
      )}

      {missingSource.length > 0 && (
        <Card withBorder radius="md" padding="sm">
          <Stack gap={4}>
            <Text size="sm" c="red" fw={600}>
              {t("ledgerMissingSourceTitle")}
            </Text>
            {missingSource.map((row, index) => (
              <Text size="xs" c="red" key={`${row.month}-${index}`}>
                {t("ledgerMissingSourceRow", {
                  month: row.month ?? "--",
                })}
              </Text>
            ))}
          </Stack>
        </Card>
      )}

      {validRows.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("ledgerEmpty")}
        </Text>
      ) : (
        <Stack gap="sm">
          {validRows.map((row) => {
            const label = row.label ?? t("ledgerRowFallbackLabel");
            const memberLabel = resolveMemberLabel(members, row.memberId);
            const amountLabel = formatCurrency(
              row.amount,
              baseCurrency,
              locale
            );
            const metaParts = [row.month];
            if (memberLabel) {
              metaParts.push(memberLabel);
            }
            return (
              <Card key={`${row.sourceEventId}-${row.month}`} withBorder radius="md" padding="sm">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Stack gap={4}>
                    <Group gap="xs" align="center">
                      <Text fw={600}>{label}</Text>
                      {row.tags?.includes("adjustment") && (
                        <Badge size="xs" variant="light" color="yellow">
                          {t("ledgerAdjustmentBadge")}
                        </Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed">
                      {t("ledgerRowMeta", {
                        month: metaParts.join(" · "),
                        amount: amountLabel,
                      })}
                    </Text>
                  </Stack>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => onEditEvent(row.sourceEventId)}
                    >
                      {common("actionEdit")}
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => onDuplicateEvent(row.sourceEventId)}
                    >
                      {t("ledgerDuplicate")}
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => onAdjustEvent(row)}
                    >
                      {t("ledgerAdjust")}
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={() => onDeleteEvent(row.sourceEventId)}
                    >
                      {common("actionDelete")}
                    </Button>
                  </Group>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
