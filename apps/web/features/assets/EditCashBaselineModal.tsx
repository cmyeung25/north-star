"use client";

import { Button, Group, Modal, NumberInput, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type EditCashBaselineModalProps = {
  opened: boolean;
  currency: string;
  value: number;
  onClose: () => void;
  onSave: (next: { amount: number }) => void;
};

export default function EditCashBaselineModal({
  opened,
  currency,
  value,
  onClose,
  onSave,
}: EditCashBaselineModalProps) {
  const t = useTranslations("money");
  const [draftAmount, setDraftAmount] = useState(value);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setDraftAmount(value);
  }, [opened, value]);

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
        <Text size="sm" c="dimmed">
          {t("cashEditImpactHint")}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("cashEditCancel")}
          </Button>
          <Button onClick={() => onSave({ amount: draftAmount })}>
            {t("cashEditSave")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
