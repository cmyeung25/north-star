import { Alert, Button, Card, Divider, Group, NumberInput, Stack, Table, Text, TextInput } from "@mantine/core";
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

export default function ExpenseStep({
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
  const tGenerated = useTranslations("onboarding.generatedCashflow");
  const t = useTranslations("onboardingV3.steps");
  const [duplicateMessage, setDuplicateMessage] = useState<string>("");

  const addManual = (rule: string | undefined, labelKey: string) => {
    if (rule && rows.some((row) => row.metadata?.generatedByRule === rule)) {
      setDuplicateMessage(tGenerated("duplicateBlocked"));
      return;
    }
    setDuplicateMessage("");
    onAddManualItem({ label: tGenerated(labelKey), amount: 0 });
  };

  const primaryTemplates = [
    {
      id: "mortgage",
      label: tGenerated("addMortgagePayment"),
      rule: "property.mortgage.payment.v1",
      labelKey: "manualMortgagePayment",
    },
    {
      id: "holding",
      label: tGenerated("addHoldingCost"),
      rule: "property.holding-cost.v1",
      labelKey: "manualHoldingCost",
    },
    { id: "manual", label: tGenerated("addManual"), rule: undefined, labelKey: "manualExpense" },
  ] as const;

  const addonTemplates = [
    { id: "transport", label: t("expense.quickAdd.transport"), rule: undefined, labelKey: "manualExpense" },
    { id: "medical", label: t("expense.quickAdd.medical"), rule: undefined, labelKey: "manualExpense" },
  ] as const;

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Text fw={600}>{t("expense.title")}</Text>
            <Text size="sm" c="dimmed">{t("expense.description")}</Text>
          </Stack>

          <Stack gap="md">
            <Text size="sm">{tGenerated("expenseHint")}</Text>
            {duplicateMessage ? <Alert color="yellow">{duplicateMessage}</Alert> : null}

            <Stack gap="xs">
              <Text size="sm" fw={600}>{t("common.frequentTemplates")}</Text>
              <Group>
                {primaryTemplates.map((template) => (
                  <Button
                    key={template.id}
                    size="xs"
                    variant="light"
                    onClick={() => addManual(template.rule, template.labelKey)}
                  >
                    {template.label}
                  </Button>
                ))}
              </Group>
            </Stack>

            <Divider label={t("common.moreQuickAdd")} />
            <Group>
              {addonTemplates.map((template) => (
                <Button
                  key={template.id}
                  size="xs"
                  variant="default"
                  onClick={() => addManual(template.rule, template.labelKey)}
                >
                  {template.label}
                </Button>
              ))}
            </Group>

            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{tGenerated("source")}</Table.Th>
                  <Table.Th>{tGenerated("baseValue")}</Table.Th>
                  <Table.Th>{tGenerated("overrideValue")}</Table.Th>
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

            <Stack gap="md">
              <Text size="sm" fw={600}>{tGenerated("manualSection")}</Text>
              {manualRows.length > 0 ? (
                manualRows.map((row) => (
                  <Card key={row.id} withBorder radius="md" padding="md">
                    <Stack gap="md">
                      <Group justify="space-between" align="flex-start">
                        <Text size="sm" fw={600}>{t("expense.manualRowTitle")}</Text>
                        <Button color="red" variant="subtle" onClick={() => onRemoveManualItem(row.id)}>
                          {tGenerated("remove")}
                        </Button>
                      </Group>
                      <Group grow>
                        <TextInput
                          value={row.label ?? ""}
                          onChange={(event) => onUpdateManualItem(row.id, { label: event.currentTarget.value })}
                        />
                        <NumberInput
                          value={row.amount}
                          onChange={(value) =>
                            onUpdateManualItem(row.id, {
                              amount: typeof value === "number" ? value : 0,
                            })
                          }
                        />
                      </Group>
                    </Stack>
                  </Card>
                ))
              ) : (
                <Card withBorder radius="md" padding="md">
                  <Text size="sm" c="dimmed">{t("expense.emptyManualHint")}</Text>
                </Card>
              )}
            </Stack>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
