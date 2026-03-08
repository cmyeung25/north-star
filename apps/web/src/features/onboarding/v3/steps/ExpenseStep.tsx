import {
  Button,
  Card,
  Collapse,
  Group,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { UI_EXPENSE_CATEGORY_KEYS } from "../../../money/categoryMeta";
import MonthField from "../../../../../components/MonthField";
import GeneratedCashflowRow from "../../../../../components/GeneratedCashflowRow";
import type { CashflowEvent } from "../../../../domain/scenarioV2/events";
import type { GeneratedItemMetadata } from "../../../../domain/scenarioDraft/types";

type AnnualMode = "monthly" | "yearly";

type ManualRow = {
  id: string;
  label?: string;
  amount: number;
  cadence?: "monthly" | "quarterly" | "yearly" | "oneOff" | "everyNMonths";
  startMonth?: string;
  endMonth?: string;
  customGrowthRatePct?: number;
  tags?: string[];
  expenseCategory?: CashflowEvent["expenseCategory"];
};

type Row = CashflowEvent & { metadata?: GeneratedItemMetadata };

type Props = {
  rows: Row[];
  manualRows: ManualRow[];
  defaultStartMonth: string;
  onAddManualItem: (item: Omit<ManualRow, "id">) => void;
  onUpdateManualItem: (eventId: string, patch: Partial<ManualRow>) => void;
  onRemoveManualItem: (eventId: string) => void;
};

const monthOptions = [
  { value: "01", label: "1" },
  { value: "02", label: "2" },
  { value: "03", label: "3" },
  { value: "04", label: "4" },
  { value: "05", label: "5" },
  { value: "06", label: "6" },
  { value: "07", label: "7" },
  { value: "08", label: "8" },
  { value: "09", label: "9" },
  { value: "10", label: "10" },
  { value: "11", label: "11" },
  { value: "12", label: "12" },
];

const hasTag = (row: ManualRow, tag: string) => Boolean(row.tags?.includes(tag));
const sectionTag = (section: string) => `onboarding:v3:expense:${section}`;

export default function ExpenseStep({ rows, manualRows, defaultStartMonth, onAddManualItem, onUpdateManualItem, onRemoveManualItem }: Props) {
  const t = useTranslations("onboardingV3.steps");
  const tMoney = useTranslations("money");
  const [dailyAdvancedOpen, setDailyAdvancedOpen] = useState(false);

  const daily = manualRows.find((row) => hasTag(row, sectionTag("daily-monthly")));
  const travel = manualRows.find((row) => hasTag(row, sectionTag("travel")));
  const tax = manualRows.find((row) => hasTag(row, sectionTag("tax")));
  const otherFixed = manualRows.filter((row) => hasTag(row, sectionTag("other-fixed")));

  const upsertSection = (section: "daily-monthly" | "travel" | "tax", patch: Partial<ManualRow>, fallbackLabel: string) => {
    const tag = sectionTag(section);
    const existing = manualRows.find((row) => hasTag(row, tag));
    if (existing) {
      onUpdateManualItem(existing.id, patch);
      return;
    }

    onAddManualItem({
      label: fallbackLabel,
      amount: 0,
      cadence: "monthly",
      startMonth: defaultStartMonth,
      tags: [tag, sectionTag("source-onboarding")],
      expenseCategory:
        section === "daily-monthly"
          ? "daily_living"
          : section === "travel"
            ? "travel"
            : "tax",
      ...patch,
    });
  };

  const travelMode: AnnualMode = travel?.cadence === "yearly" ? "yearly" : "monthly";
  const taxMode: AnnualMode = tax?.cadence === "yearly" ? "yearly" : "monthly";

  const travelAnnualMonths = useMemo(() => {
    const token = travel?.tags?.find((tag) => tag.startsWith("allocation:"));
    return token ? token.replace("allocation:", "").split(",").filter(Boolean) : [];
  }, [travel?.tags]);

  const taxAnnualMonths = useMemo(() => {
    const token = tax?.tags?.find((tag) => tag.startsWith("allocation:"));
    return token ? token.replace("allocation:", "").split(",").filter(Boolean) : [];
  }, [tax?.tags]);

  const withAllocationTags = (months: string[], existingTags: string[] = []) => {
    const tags = existingTags.filter((tag) => !tag.startsWith("allocation:"));
    return [...tags, `allocation:${months.join(",")}`];
  };

  const expenseCategoryOptions = useMemo(
    () =>
      UI_EXPENSE_CATEGORY_KEYS.map((key) => ({
        value: key,
        label: tMoney(`expenseCategory.${key}`),
      })),
    [tMoney]
  );

  const resolveExpenseCategoryLabel = (category?: CashflowEvent["expenseCategory"]) => {
    if (!category) {
      return null;
    }

    return tMoney(`expenseCategory.${category}`);
  };

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Text fw={600}>{t("expense.settingTitle")}</Text>
          {resolveExpenseCategoryLabel(daily?.expenseCategory) ? (
            <Text size="xs" c="dimmed">
              {t("expense.categoryPreview", { category: resolveExpenseCategoryLabel(daily?.expenseCategory) ?? "" })}
            </Text>
          ) : null}
          <Select
            label={t("expense.fields.category")}
            data={expenseCategoryOptions}
            value={daily?.expenseCategory ?? "daily_living"}
            onChange={(value) =>
              upsertSection("daily-monthly", { expenseCategory: (value as ManualRow["expenseCategory"]) ?? "daily_living" }, t("expense.dailyMonthlyLabel"))
            }
          />
          <NumberInput
            label={t("expense.dailyMonthlyLabel")}
            min={0}
            value={daily?.amount ?? 0}
            onChange={(value) => upsertSection("daily-monthly", { amount: typeof value === "number" ? value : 0 }, t("expense.dailyMonthlyLabel"))}
          />
          <Switch
            label={t("expense.showAdvanced")}
            checked={dailyAdvancedOpen}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              setDailyAdvancedOpen(checked);
              if (!checked && daily) {
                onUpdateManualItem(daily.id, { customGrowthRatePct: 0, startMonth: defaultStartMonth });
              }
            }}
          />
          <Collapse in={dailyAdvancedOpen}>
            <Group grow>
              <NumberInput
                label={t("expense.advancedGrowth")}
                value={daily?.customGrowthRatePct ?? 0}
                onChange={(value) => upsertSection("daily-monthly", { customGrowthRatePct: typeof value === "number" ? value : 0 }, t("expense.dailyMonthlyLabel"))}
              />
              <MonthField
                label={t("expense.advancedStartMonth")}
                value={daily?.startMonth ?? defaultStartMonth}
                onChange={(value) => upsertSection("daily-monthly", { startMonth: value || defaultStartMonth }, t("expense.dailyMonthlyLabel"))}
              />
            </Group>
          </Collapse>
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Text fw={600}>{t("expense.travelTitle")}</Text>
          {resolveExpenseCategoryLabel(travel?.expenseCategory) ? (
            <Text size="xs" c="dimmed">
              {t("expense.categoryPreview", { category: resolveExpenseCategoryLabel(travel?.expenseCategory) ?? "" })}
            </Text>
          ) : null}
          <Select
            label={t("expense.fields.category")}
            data={expenseCategoryOptions}
            value={travel?.expenseCategory ?? "travel"}
            onChange={(value) =>
              upsertSection("travel", { expenseCategory: (value as ManualRow["expenseCategory"]) ?? "travel" }, t("expense.travelTitle"))
            }
          />
          <SegmentedControl value={travelMode} data={[{ label: t("expense.modeMonthly"), value: "monthly" }, { label: t("expense.modeYearly"), value: "yearly" }]} onChange={(value) => upsertSection("travel", { cadence: value === "yearly" ? "yearly" : "monthly" }, t("expense.travelTitle"))} />
          <NumberInput label={travelMode === "yearly" ? t("expense.yearlyAmount") : t("expense.monthlyAmount")} min={0} value={travel?.amount ?? 0} onChange={(value) => upsertSection("travel", { amount: typeof value === "number" ? value : 0 }, t("expense.travelTitle"))} />
          {travelMode === "yearly" ? <MultiSelect label={t("expense.allocateMonths")} data={monthOptions} value={travelAnnualMonths} onChange={(value) => upsertSection("travel", { tags: withAllocationTags(value, travel?.tags) }, t("expense.travelTitle"))} /> : null}
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Text fw={600}>{t("expense.taxTitle")}</Text>
          {resolveExpenseCategoryLabel(tax?.expenseCategory) ? (
            <Text size="xs" c="dimmed">
              {t("expense.categoryPreview", { category: resolveExpenseCategoryLabel(tax?.expenseCategory) ?? "" })}
            </Text>
          ) : null}
          <Select
            label={t("expense.fields.category")}
            data={expenseCategoryOptions}
            value={tax?.expenseCategory ?? "tax"}
            onChange={(value) =>
              upsertSection("tax", { expenseCategory: (value as ManualRow["expenseCategory"]) ?? "tax" }, t("expense.taxTitle"))
            }
          />
          <SegmentedControl value={taxMode} data={[{ label: t("expense.modeMonthly"), value: "monthly" }, { label: t("expense.modeYearly"), value: "yearly" }]} onChange={(value) => upsertSection("tax", { cadence: value === "yearly" ? "yearly" : "monthly" }, t("expense.taxTitle"))} />
          <NumberInput label={taxMode === "yearly" ? t("expense.yearlyAmount") : t("expense.monthlyAmount")} min={0} value={tax?.amount ?? 0} onChange={(value) => upsertSection("tax", { amount: typeof value === "number" ? value : 0 }, t("expense.taxTitle"))} />
          {taxMode === "yearly" ? <MultiSelect label={t("expense.allocateMonths")} data={monthOptions} value={taxAnnualMonths} onChange={(value) => upsertSection("tax", { tags: withAllocationTags(value, tax?.tags) }, t("expense.taxTitle"))} /> : null}
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600}>{t("expense.otherFixedTitle")}</Text>
            <Button size="xs" onClick={() => onAddManualItem({ label: "", amount: 0, cadence: "monthly", startMonth: defaultStartMonth, expenseCategory: "other", tags: [sectionTag("other-fixed"), sectionTag("source-onboarding")] })}>{t("expense.addOtherFixed")}</Button>
          </Group>
          {otherFixed.map((row) => (
            <Stack key={row.id} gap="xs">
              {resolveExpenseCategoryLabel(row.expenseCategory) ? (
                <Text size="xs" c="dimmed">
                  {t("expense.categoryPreview", { category: resolveExpenseCategoryLabel(row.expenseCategory) ?? "" })}
                </Text>
              ) : null}
              <Group grow>
              <TextInput value={row.label ?? ""} placeholder={t("expense.otherFixedLabel")} onChange={(e) => onUpdateManualItem(row.id, { label: e.currentTarget.value })} />
              <NumberInput value={row.amount} min={0} onChange={(value) => onUpdateManualItem(row.id, { amount: typeof value === "number" ? value : 0 })} />
              <Select
                data={expenseCategoryOptions}
                label={t("expense.fields.category")}
                value={row.expenseCategory ?? "other"}
                onChange={(value) =>
                  onUpdateManualItem(row.id, {
                    expenseCategory: (value as ManualRow["expenseCategory"]) ?? "other",
                  })
                }
              />
              <MonthField value={row.startMonth ?? defaultStartMonth} onChange={(value) => onUpdateManualItem(row.id, { startMonth: value || defaultStartMonth })} />
              <MonthField value={row.endMonth ?? ""} onChange={(value) => onUpdateManualItem(row.id, { endMonth: value || undefined })} />
              <Button color="red" variant="subtle" onClick={() => onRemoveManualItem(row.id)}>-</Button>
            </Group>
            </Stack>
          ))}
        </Stack>
      </Card>

      {rows.length > 0 ? (
        <Card withBorder radius="md" padding="md">
          <Stack gap="sm">
            <Text fw={600}>{t("expense.systemGeneratedSection")}</Text>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("expense.autoGeneratedSource")}</Table.Th>
                  <Table.Th>{t("expense.autoGeneratedAmount")}</Table.Th>
                  <Table.Th>{t("expense.autoGeneratedStatus")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => (
                  <GeneratedCashflowRow key={row.id} id={row.id} rule={row.metadata?.generatedByRule} baseAmount={row.amount} readOnly />
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
