"use client";

import { Button, Group, Modal, NumberInput, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import MonthField from "../../components/MonthField";

type EditCashBaselineModalProps = {
  opened: boolean;
  currency: string;
  value: number;
  baseMonth: string | null;
  onClose: () => void;
  onSave: (next: { amount: number; baseMonth: string | null }) => void;
};

export default function EditCashBaselineModal({
  opened,
  currency,
  value,
  baseMonth,
  onClose,
  onSave,
}: EditCashBaselineModalProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const [draftAmount, setDraftAmount] = useState(value);
  const [draftBaseMonth, setDraftBaseMonth] = useState<string | null>(baseMonth);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setDraftAmount(value);
    setDraftBaseMonth(baseMonth);
  }, [opened, value, baseMonth]);

  return (
    <Modal opened={opened} onClose={onClose} title={t("cashEditOpen")} centered>
      <Stack gap="md">
        <NumberInput
          label={t("cashCardAmountLabel", { currency })}
          value={draftAmount}
          min={0}
          allowNegative={false}
          onChange={(nextValue) =>
            setDraftAmount(typeof nextValue === "number" ? Math.max(0, nextValue) : 0)
          }
        />
        <MonthField
          label={t("cashCardMonthLabel")}
          placeholder={common("yearMonthPlaceholder")}
          value={draftBaseMonth ?? ""}
          onChange={(nextValue) =>
            setDraftBaseMonth(nextValue.trim() === "" ? null : nextValue)
          }
        />
        <Text size="sm" c="dimmed">
          {t("cashEditImpactHint")}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("cashEditCancel")}
          </Button>
          <Button onClick={() => onSave({ amount: draftAmount, baseMonth: draftBaseMonth })}>
            {t("cashEditSave")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
