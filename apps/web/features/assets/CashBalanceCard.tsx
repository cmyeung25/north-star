"use client";

import React, { forwardRef } from "react";
import { Card, Group, NumberInput, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import MonthField from "../../components/MonthField";

type CashBalanceCardProps = {
  value: number;
  baseMonth: string | null;
  currency: string;
  amountInputRef?: React.RefObject<HTMLInputElement>;
  onChangeAmount: (value: number) => void;
  onChangeBaseMonth: (value: string | null) => void;
};

const CashBalanceCard = forwardRef<HTMLDivElement, CashBalanceCardProps>(
  ({ value, baseMonth, currency, amountInputRef, onChangeAmount, onChangeBaseMonth }, ref) => {
    const t = useTranslations("money");
    const common = useTranslations("common");

    return (
      <Card withBorder radius="md" padding="md" ref={ref}>
        <Stack gap="xs">
          <div>
            <Text fw={600}>{t("cashCardTitle")}</Text>
            <Text size="sm" c="dimmed">
              {t("cashCardHint")}
            </Text>
          </div>
          <Group grow align="flex-start">
            <NumberInput
              label={t("cashCardAmountLabel", { currency })}
              value={value}
              min={0}
              allowNegative={false}
              onChange={(nextValue) =>
                onChangeAmount(typeof nextValue === "number" ? nextValue : 0)
              }
              ref={amountInputRef}
            />
            <MonthField
              label={t("cashCardMonthLabel")}
              placeholder={common("yearMonthPlaceholder")}
              value={baseMonth ?? ""}
              onChange={(nextValue) =>
                onChangeBaseMonth(nextValue.trim() === "" ? null : nextValue)
              }
            />
          </Group>
        </Stack>
      </Card>
    );
  }
);

CashBalanceCard.displayName = "CashBalanceCard";

export default CashBalanceCard;
