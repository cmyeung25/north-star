import { Alert, Button, Group, NumberInput, Stack, Table, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import { useTranslations } from "next-intl";
import GeneratedCashflowRow from "../../../../../components/GeneratedCashflowRow";
import type { CashflowEvent } from "../../../../domain/scenarioV2/events";
import type { GeneratedItemMetadata } from "../../../../domain/scenarioDraft/types";

type Row = CashflowEvent & { metadata?: GeneratedItemMetadata };

type ManualRow = {
  id: string;
  label?: string;
  amount: number;
};

type Props = {
  rows: Row[];
  manualRows: ManualRow[];
  overrides: Record<string, { amount?: number; disabled?: boolean }>;
  onOverrideAmount: (eventId: string, amount: number) => void;
  onRestoreSuggested: (eventId: string) => void;
  onToggleDisabled: (eventId: string, disabled: boolean) => void;
  onAddManualItem: (item: { label: string; amount: number }) => void;
  onUpdateManualItem: (eventId: string, patch: Partial<ManualRow>) => void;
  onRemoveManualItem: (eventId: string) => void;
};

export default function IncomeStep({
  rows,
  manualRows,
  overrides,
  onOverrideAmount,
  onRestoreSuggested,
  onToggleDisabled,
  onAddManualItem,
  onUpdateManualItem,
  onRemoveManualItem,
}: Props) {
  const t = useTranslations("onboarding.generatedCashflow");
  const [duplicateMessage, setDuplicateMessage] = useState<string>("");

  const addManual = (rule: string | undefined, labelKey: string) => {
    if (rule && rows.some((row) => row.metadata?.generatedByRule === rule)) {
      setDuplicateMessage(t("duplicateBlocked"));
      return;
    }
    setDuplicateMessage("");
    onAddManualItem({ label: t(labelKey), amount: 0 });
  };

  return (
    <Stack>
      <Text size="sm">{t("incomeHint")}</Text>
      {duplicateMessage ? <Alert color="yellow">{duplicateMessage}</Alert> : null}
      <Group>
        <Button size="xs" variant="light" onClick={() => addManual("property.rent.income.v1", "manualRentIncome")}>{t("addRentIncome")}</Button>
        <Button size="xs" onClick={() => addManual(undefined, "manualIncome")}>{t("addManual")}</Button>
      </Group>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("source")}</Table.Th>
            <Table.Th>{t("baseValue")}</Table.Th>
            <Table.Th>{t("overrideValue")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <GeneratedCashflowRow
              key={row.id}
              id={row.id}
              rule={row.metadata?.generatedByRule}
              baseAmount={row.amount}
              overrideAmount={overrides[row.id]?.amount}
              disabled={overrides[row.id]?.disabled}
              onOverrideAmount={(value) => onOverrideAmount(row.id, value)}
              onRestoreSuggested={() => onRestoreSuggested(row.id)}
              onToggleDisabled={(value) => onToggleDisabled(row.id, value)}
            />
          ))}
        </Table.Tbody>
      </Table>

      {manualRows.length > 0 ? (
        <Stack gap="xs">
          <Text size="sm" fw={600}>{t("manualSection")}</Text>
          {manualRows.map((row) => (
            <Group key={row.id} grow>
              <TextInput value={row.label ?? ""} onChange={(event) => onUpdateManualItem(row.id, { label: event.currentTarget.value })} />
              <NumberInput value={row.amount} onChange={(value) => onUpdateManualItem(row.id, { amount: typeof value === "number" ? value : 0 })} />
              <Button color="red" variant="subtle" onClick={() => onRemoveManualItem(row.id)}>{t("remove")}</Button>
            </Group>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
