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
import { UI_INCOME_CATEGORY_KEYS } from "../../../money/categoryMeta";
import MoneyMetaTags from "../../../money/MoneyMetaTags";
import MonthField from "../../../../../components/MonthField";
import GeneratedCashflowRow from "../../../../../components/GeneratedCashflowRow";
import type { CashflowEvent } from "../../../../domain/scenarioV2/events";
import type { MoneyTagItem } from "../../../money/moneyTagConfig";
import type { GeneratedItemMetadata } from "../../../../domain/scenarioDraft/types";

type Row = CashflowEvent & { metadata?: GeneratedItemMetadata };

type ManualRow = {
  id: string;
  title?: string;
  isCustomTitle?: boolean;
  label?: string;
  amount: number;
  cadence: "monthly" | "quarterly" | "yearly" | "oneOff" | "everyNMonths";
  memberId?: string;
  startMonth?: string;
  endMonth?: string;
  followIncomeGrowth: boolean;
  tags?: string[];
  category?: CashflowEvent["category"];
};

type Props = {
  rows: Row[];
  manualRows: ManualRow[];
  members: Array<{ id: string; name?: string }>;
  defaultStartMonth: string;
  defaultSalaryGrowthRate: number;
  onAddManualItem: (item: Omit<ManualRow, "id">) => void;
  onUpdateManualItem: (eventId: string, patch: Partial<ManualRow>) => void;
  onRemoveManualItem: (eventId: string) => void;
  onDuplicateManualItem: (eventId: string) => void;
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
  defaultStartMonth,
  defaultSalaryGrowthRate,
  onAddManualItem,
  onUpdateManualItem,
  onRemoveManualItem,
  onDuplicateManualItem,
}: Props) {
  const tGenerated = useTranslations("onboarding.generatedCashflow");
  const t = useTranslations("onboardingV3.steps");
  const tMoney = useTranslations("money");
  const [duplicateMessage, setDuplicateMessage] = useState<string>("");
  const followIncomeGrowthRate = Number.isFinite(defaultSalaryGrowthRate) ? defaultSalaryGrowthRate : 3;

  const memberOptions = useMemo(
    () => [
      { value: "", label: t("income.fields.memberOptional") },
      ...members.map((member) => ({
        value: member.id,
        label: member.name?.trim() || member.id,
      })),
    ],
    [members, t]
  );

  const incomeCategoryOptions = useMemo(
    () =>
      UI_INCOME_CATEGORY_KEYS.map((key) => ({
        value: key,
        label: tMoney(`incomeCategory.${key}`),
      })),
    [tMoney]
  );

  const resolveIncomeCategoryLabel = (category?: CashflowEvent["category"]) => {
    if (!category) {
      return null;
    }

    return tMoney(`incomeCategory.${category}`);
  };

  const buildIncomeCategoryTag = (rowId: string, category?: CashflowEvent["category"]): MoneyTagItem[] => {
    const label = resolveIncomeCategoryLabel(category);
    if (!label) {
      return [];
    }

    return [
      {
        key: `income-category-${rowId}`,
        label,
        kind: "category",
      },
    ];
  };

  const addManual = (rule: string | undefined, item: Omit<ManualRow, "id">) => {
    if (rule && rows.some((row) => row.metadata?.generatedByRule === rule)) {
      setDuplicateMessage(tGenerated("duplicateBlocked"));
      return;
    }
    setDuplicateMessage("");
    onAddManualItem(item);
  };

  const fallbackManualTitle = t("income.manualRowTitle");
  const resolveManualTitle = (title?: string) => title?.trim() || fallbackManualTitle;

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
        category: "salary" as const,
        tags: ["onboarding:v3:income:salary", "onboarding:v3:income:source-onboarding"],
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
        category: "bonus" as const,
        tags: ["onboarding:v3:income:bonus", "onboarding:v3:income:source-onboarding"],
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
        category: "rental" as const,
        tags: ["onboarding:v3:income:rent", "onboarding:v3:income:source-onboarding"],
      },
    },
  ];

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
        category: "other" as const,
        tags: ["onboarding:v3:income:allowance", "onboarding:v3:income:source-onboarding"],
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
        category: "other" as const,
        tags: ["onboarding:v3:income:manual", "onboarding:v3:income:source-onboarding"],
      },
    },
  ];

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Stack gap={4}>
            <Text fw={600}>{t("income.settingTitle")}</Text>
          </Stack>

          <Stack gap="md">
            {duplicateMessage ? <Alert color="yellow">{duplicateMessage}</Alert> : null}
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                {t("common.frequentTemplates")}
              </Text>
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

            <Stack gap="md">
              <Text size="sm" fw={600}>
                {tGenerated("manualSection")}
              </Text>
              {manualRows.length > 0 ? (
                manualRows.map((row) => (
                  <Card key={row.id} withBorder radius="md" padding="md">
                    <Stack gap="md">
                      <Group justify="space-between" align="flex-start">
                        <Text size="sm" fw={600}>
                          {resolveManualTitle(row.title)}
                        </Text>
                        <MoneyMetaTags tags={buildIncomeCategoryTag(row.id, row.category)} />
                        <Group gap="xs">
                          <Button variant="subtle" onClick={() => onDuplicateManualItem(row.id)}>
                            {t("income.actions.copy")}
                          </Button>
                          <Button color="red" variant="subtle" onClick={() => onRemoveManualItem(row.id)}>
                            {tGenerated("remove")}
                          </Button>
                        </Group>
                      </Group>
                      <TextInput
                        label={t("income.fields.cardTitle")}
                        value={row.title ?? ""}
                        placeholder={fallbackManualTitle}
                        onChange={(event) =>
                          onUpdateManualItem(row.id, {
                            title: event.currentTarget.value,
                            isCustomTitle: true,
                          })
                        }
                      />
                      <Group grow align="flex-start">
                        <TextInput
                          label={t("income.fields.name")}
                          value={row.label ?? ""}
                          onChange={(event) => {
                            const nextLabel = event.currentTarget.value;
                            onUpdateManualItem(row.id, {
                              label: nextLabel,
                              ...(row.isCustomTitle
                                ? {}
                                : {
                                    title: nextLabel.trim() || fallbackManualTitle,
                                  }),
                            });
                          }}
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
                          onChange={(value) => onUpdateManualItem(row.id, { memberId: value ?? "" })}
                        />
                      </Group>
                      <Select
                        label={t("income.fields.category")}
                        data={incomeCategoryOptions}
                        value={row.category ?? "other"}
                        onChange={(value) =>
                          onUpdateManualItem(row.id, {
                            category: (value as ManualRow["category"]) ?? "other",
                          })
                        }
                      />
                      <Group grow align="flex-start">
                        <MonthField
                          label={t("income.fields.startMonth")}
                          value={row.startMonth ?? ""}
                          onChange={(value) => onUpdateManualItem(row.id, { startMonth: value || undefined })}
                        />
                        <MonthField
                          label={t("income.fields.endMonth")}
                          value={row.endMonth ?? ""}
                          disabled={row.cadence === "oneOff"}
                          onChange={(value) => onUpdateManualItem(row.id, { endMonth: value || undefined })}
                        />
                      </Group>
                      <Switch
                        label={t("income.fields.followIncomeGrowthWithRate", {
                          rate: followIncomeGrowthRate,
                        })}
                        description={t("income.fields.followIncomeGrowthDescription")}
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
                  <Text size="sm" c="dimmed">
                    {t("income.emptyManualHint")}
                  </Text>
                </Card>
              )}
            </Stack>

            {rows.length > 0 ? (
              <Stack gap="sm">
                <Text size="sm" fw={600}>
                  {t("income.systemGeneratedSection")}
                </Text>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{tGenerated("source")}</Table.Th>
                      <Table.Th>{tGenerated("baseValue")}</Table.Th>
                      <Table.Th>{t("income.displayMode")}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((row) => (
                      <GeneratedCashflowRow
                        key={row.id}
                        id={row.id}
                        rule={row.metadata?.generatedByRule}
                        baseAmount={row.amount}
                        readOnly
                      />
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            ) : null}
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
