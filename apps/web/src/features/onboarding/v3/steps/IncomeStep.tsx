import {
  Alert,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import MonthField from "../../../../../components/MonthField";
import GeneratedCashflowRow from "../../../../../components/GeneratedCashflowRow";
import type { CashflowEvent } from "../../../../domain/scenarioV2/events";
import type { GeneratedItemMetadata } from "../../../../domain/scenarioDraft/types";

type Row = CashflowEvent & { metadata?: GeneratedItemMetadata };

type ManualRow = {
  id: string;
  label?: string;
  amount: number;
  cadence: "monthly" | "quarterly" | "yearly" | "oneOff" | "everyNMonths";
  memberId?: string;
  startMonth?: string;
  endMonth?: string;
  followIncomeGrowth: boolean;
};

type Props = {
  rows: Row[];
  manualRows: ManualRow[];
  members: Array<{ id: string; name?: string }>;
  overrides: Record<string, { amount?: number; disabled?: boolean }>;
  defaultStartMonth: string;
  onOverrideAmount: (eventId: string, amount: number) => void;
  onRestoreSuggested: (eventId: string) => void;
  onToggleDisabled: (eventId: string, disabled: boolean) => void;
  onAddManualItem: (item: Omit<ManualRow, "id">) => void;
  onUpdateManualItem: (eventId: string, patch: Partial<ManualRow>) => void;
  onRemoveManualItem: (eventId: string) => void;
};

const frequencyOptions: Array<{ value: Exclude<ManualRow["cadence"], "everyNMonths">; labelKey: string }> = [
  { value: "monthly", labelKey: "monthly" },
  { value: "quarterly", labelKey: "quarterly" },
  { value: "yearly", labelKey: "yearly" },
  { value: "oneOff", labelKey: "oneOff" },
];

export default function IncomeStep({
  rows,
  manualRows,
  members,
  overrides,
  defaultStartMonth,
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

  const memberOptions = useMemo(
    () => [
      { value: "", label: t("income.memberOptional") },
      ...members.map((member) => ({
        value: member.id,
        label: member.name?.trim() || member.id,
      })),
    ],
    [members, t]
  );

  const addManual = (
    rule: string | undefined,
    item: Omit<ManualRow, "id">,
  ) => {
    if (rule && rows.some((row) => row.metadata?.generatedByRule === rule)) {
      setDuplicateMessage(tGenerated("duplicateBlocked"));
      return;
    }
    setDuplicateMessage("");
    onAddManualItem(item);
  };

  const primaryTemplates = [
    {
      id: "salary",
      label: t("income.quickAdd.salary"),
      rule: undefined,
      item: {
        label: t("income.templates.salary"),
        amount: 0,
        cadence: "monthly" as const,
        memberId: "self",
        startMonth: defaultStartMonth,
        endMonth: undefined,
        followIncomeGrowth: true,
      },
    },
    {
      id: "bonus",
      label: t("income.quickAdd.bonus"),
      rule: undefined,
      item: {
        label: t("income.templates.bonus"),
        amount: 0,
        cadence: "oneOff" as const,
        memberId: "",
        startMonth: defaultStartMonth,
        endMonth: undefined,
        followIncomeGrowth: false,
      },
    },
    {
      id: "rent",
      label: tGenerated("addRentIncome"),
      rule: "property.rent.income.v1",
      item: {
        label: tGenerated("manualRentIncome"),
        amount: 0,
        cadence: "monthly" as const,
        memberId: "",
        startMonth: defaultStartMonth,
        endMonth: undefined,
        followIncomeGrowth: false,
      },
    },
  ] as const;

  const addonTemplates = [
    {
      id: "allowance",
      label: t("income.quickAdd.allowance"),
      rule: undefined,
      item: {
        label: t("income.templates.allowance"),
        amount: 0,
        cadence: "monthly" as const,
        memberId: "",
        startMonth: defaultStartMonth,
        endMonth: undefined,
        followIncomeGrowth: false,
      },
    },
    {
      id: "manual",
      label: tGenerated("addManual"),
      rule: undefined,
      item: {
        label: tGenerated("manualIncome"),
        amount: 0,
        cadence: "monthly" as const,
        memberId: "",
        startMonth: defaultStartMonth,
        endMonth: undefined,
        followIncomeGrowth: true,
      },
    },
  ] as const;

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Text fw={600}>{t("income.title")}</Text>
            <Text size="sm" c="dimmed">{t("income.description")}</Text>
          </Stack>

          <Stack gap="md">
            <Text size="sm">{tGenerated("incomeHint")}</Text>
            {duplicateMessage ? <Alert color="yellow">{duplicateMessage}</Alert> : null}

            <Stack gap="xs">
              <Text size="sm" fw={600}>{t("common.frequentTemplates")}</Text>
              <Group>
                {primaryTemplates.map((template) => (
                  <Button
                    key={template.id}
                    size="xs"
                    variant="light"
                    onClick={() => addManual(template.rule, template.item)}
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
                  onClick={() => addManual(template.rule, template.item)}
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
                        <Text size="sm" fw={600}>{t("income.manualRowTitle")}</Text>
                        <Button color="red" variant="subtle" onClick={() => onRemoveManualItem(row.id)}>
                          {tGenerated("remove")}
                        </Button>
                      </Group>
                      <Group grow align="flex-start">
                        <TextInput
                          label={t("income.fields.name")}
                          value={row.label ?? ""}
                          onChange={(event) => onUpdateManualItem(row.id, { label: event.currentTarget.value })}
                        />
                        <NumberInput
                          label={t("income.fields.amount")}
                          min={0}
                          value={row.amount}
                          onChange={(value) =>
                            onUpdateManualItem(row.id, {
                              amount: typeof value === "number" ? value : 0,
                            })
                          }
                        />
                      </Group>
                      <Group grow align="flex-start">
                        <Select
                          label={t("income.fields.frequency")}
                          data={frequencyOptions.map((option) => ({
                            value: option.value,
                            label: t(`income.frequency.${option.labelKey}`),
                          }))}
                          value={row.cadence}
                          onChange={(value) =>
                            onUpdateManualItem(row.id, {
                              cadence: (value as ManualRow["cadence"]) ?? "monthly",
                            })
                          }
                        />
                        <Select
                          label={t("income.fields.memberId")}
                          data={memberOptions}
                          value={row.memberId ?? ""}
                          onChange={(value) =>
                            onUpdateManualItem(row.id, { memberId: value ?? "" })
                          }
                        />
                      </Group>
                      <Group grow align="flex-start">
                        <MonthField
                          label={t("income.fields.startMonth")}
                          value={row.startMonth ?? ""}
                          onChange={(value) =>
                            onUpdateManualItem(row.id, {
                              startMonth: value || undefined,
                            })
                          }
                        />
                        <MonthField
                          label={t("income.fields.endMonth")}
                          value={row.endMonth ?? ""}
                          disabled={row.cadence === "oneOff"}
                          onChange={(value) =>
                            onUpdateManualItem(row.id, {
                              endMonth: value || undefined,
                            })
                          }
                        />
                      </Group>
                      <Switch
                        label={t("income.fields.followIncomeGrowth")}
                        checked={row.followIncomeGrowth}
                        disabled={row.cadence === "oneOff"}
                        onChange={(event) =>
                          onUpdateManualItem(row.id, {
                            followIncomeGrowth: event.currentTarget.checked,
                          })
                        }
                      />
                    </Stack>
                  </Card>
                ))
              ) : (
                <Card withBorder radius="md" padding="md">
                  <Text size="sm" c="dimmed">{t("income.emptyManualHint")}</Text>
                </Card>
              )}
            </Stack>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
