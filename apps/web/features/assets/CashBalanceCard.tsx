"use client";

import React, { forwardRef } from "react";
import { Button, Card, Group, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { formatCurrency } from "../../lib/i18n";

type CashBalanceCardProps = {
  value: number;
  baseMonth: string | null;
  currency: string;
  locale: string;
  onEdit: () => void;
};

const CashBalanceCard = forwardRef<HTMLDivElement, CashBalanceCardProps>(
  ({ value, baseMonth, currency, locale, onEdit }, ref) => {
    const t = useTranslations("money");

    return (
      <Card withBorder radius="md" padding="md" ref={ref}>
        <Stack gap="xs">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <div>
              <Text fw={600}>{t("cashCardTitle")}</Text>
              <Text size="sm" c="dimmed">
                {t("cashCardHint")}
              </Text>
            </div>
            <Button variant="light" onClick={onEdit}>
              {t("cashEditOpen")}
            </Button>
          </Group>
          <Group gap="xl" wrap="wrap">
            <div>
              <Text size="xs" c="dimmed">
                {t("cashCardAmountLabel", { currency })}
              </Text>
              <Text fw={600}>{formatCurrency(value, currency, locale)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                {t("cashCardMonthLabel")}
              </Text>
              <Text fw={600}>{baseMonth ?? t("cashCardMonthUnset")}</Text>
            </div>
          </Group>
        </Stack>
      </Card>
    );
  }
);

CashBalanceCard.displayName = "CashBalanceCard";

export default CashBalanceCard;
