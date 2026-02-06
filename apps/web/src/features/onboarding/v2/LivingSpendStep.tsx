"use client";

import {
  Accordion,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { nanoid } from "nanoid";
import { useMemo } from "react";
import { buildMonthRange } from "@north-star/engine";
import MonthField from "../../../../components/MonthField";
import { getCurrentMonth } from "../utils";
import { isValidMonthKey } from "../../../utils/monthKey";
import type { OnboardingV2DraftLivingSpend } from "../../../domain/onboarding/v2/draftTypes";

type LivingSpendErrors = {
  fixed: Partial<{ amount: string; startMonth: string; endMonth: string }>;
  travel: Partial<{ months: string }>;
  tax: Partial<{ months: string }>;
  otherFixed: Record<
    string,
    Partial<{ label: string; amount: string; startMonth: string; endMonth: string }>
  >;
};

type LivingSpendStepProps = {
  livingSpend: OnboardingV2DraftLivingSpend;
  baseMonth: string;
  horizonYears: 3 | 5 | 10;
  errors: LivingSpendErrors;
  onChange: (next: OnboardingV2DraftLivingSpend) => void;
  t: (key: string, values?: Record<string, number>) => string;
};

const resolveHorizonMonths = (years: 3 | 5 | 10) => {
  if (years === 3) {
    return 36;
  }
  if (years === 10) {
    return 120;
  }
  return 60;
};

const toNumber = (value: number | string) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export default function LivingSpendStep({
  livingSpend,
  baseMonth,
  horizonYears,
  errors,
  onChange,
  t,
}: LivingSpendStepProps) {
  const safeBaseMonth = useMemo(
    () => (isValidMonthKey(baseMonth) ? baseMonth : getCurrentMonth()),
    [baseMonth]
  );
  const monthOptions = useMemo(() => {
    const horizonMonths = resolveHorizonMonths(horizonYears);
    const months = buildMonthRange(safeBaseMonth, horizonMonths);
    return months.map((month) => ({ value: month, label: month }));
  }, [horizonYears, safeBaseMonth]);

  const categoryFields = [
    { key: "food", label: t("livingCategoryFood") },
    { key: "transport", label: t("livingCategoryTransport") },
    { key: "entertainment", label: t("livingCategoryEntertainment") },
    { key: "medical", label: t("livingCategoryMedical") },
    { key: "education", label: t("livingCategoryEducation") },
    { key: "misc", label: t("livingCategoryMisc") },
  ] as const;

  const updateFixed = (patch: Partial<OnboardingV2DraftLivingSpend["fixed"]>) => {
    onChange({
      ...livingSpend,
      fixed: {
        ...livingSpend.fixed,
        ...patch,
      },
    });
  };

  const updateVariable = (
    patch: Partial<OnboardingV2DraftLivingSpend["variable"]>
  ) => {
    onChange({
      ...livingSpend,
      variable: {
        ...livingSpend.variable,
        ...patch,
      },
    });
  };

  const updateCategoryBreakdown = (
    patch: Partial<OnboardingV2DraftLivingSpend["categoryBreakdown"]>
  ) => {
    onChange({
      ...livingSpend,
      categoryBreakdown: {
        ...livingSpend.categoryBreakdown,
        ...patch,
      },
    });
  };

  const updateCategoryAmount = (key: keyof typeof livingSpend.categoryBreakdown.categories, amount: number) => {
    onChange({
      ...livingSpend,
      categoryBreakdown: {
        ...livingSpend.categoryBreakdown,
        categories: {
          ...livingSpend.categoryBreakdown.categories,
          [key]: amount,
        },
      },
    });
  };

  const updateAnnualExpense = (
    key: "travel" | "tax",
    patch: Partial<OnboardingV2DraftLivingSpend["travel"]>
  ) => {
    onChange({
      ...livingSpend,
      [key]: {
        ...livingSpend[key],
        ...patch,
      },
    });
  };

  const updateOtherFixed = (
    id: string,
    patch: Partial<OnboardingV2DraftLivingSpend["otherFixed"][number]>
  ) => {
    onChange({
      ...livingSpend,
      otherFixed: livingSpend.otherFixed.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    });
  };

  const removeOtherFixed = (id: string) => {
    onChange({
      ...livingSpend,
      otherFixed: livingSpend.otherFixed.filter((item) => item.id !== id),
    });
  };

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Title order={4}>{t("livingSpendTitle")}</Title>
          <Text size="sm" c="dimmed">
            {t("livingSpendHint")}
          </Text>
          <Badge variant="light" color="blue">
            核心（1 分鐘）
          </Badge>
          <Group grow align="flex-start">
            <NumberInput
              label={`${t("livingFixedAmount")}（必填）`}
              min={0}
              value={livingSpend.fixed.amount === 0 ? "" : livingSpend.fixed.amount}
              placeholder="例如：15,000"
              error={errors.fixed.amount}
              onChange={(value) => updateFixed({ amount: toNumber(value) })}
            />
            <MonthField
              label={`${t("livingFixedStartMonth")}（必填）`}
              placeholder={t("monthPlaceholder")}
              value={livingSpend.fixed.startMonth ?? ""}
              error={errors.fixed.startMonth}
              onChange={(value) => updateFixed({ startMonth: value })}
            />
          </Group>
          <MonthField
            label={`${t("livingFixedEndMonth")}（可選）`}
            placeholder={t("monthPlaceholder")}
            value={livingSpend.fixed.endMonth ?? ""}
            error={errors.fixed.endMonth}
            onChange={(value) => updateFixed({ endMonth: value })}
          />
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group align="center" justify="space-between">
            <Title order={5}>{t("livingCategoryTitle")}</Title>
            <Badge variant="light">{t("livingOptional")}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t("livingCategoryHint")}
          </Text>
          <Switch
            label={`${t("livingCategoryToggle")}（可選）`}
            checked={livingSpend.categoryBreakdown.enabled}
            onChange={(event) =>
              updateCategoryBreakdown({ enabled: event.currentTarget.checked })
            }
          />
        </Stack>
      </Card>

      <Accordion variant="separated">
        <Accordion.Item value="advanced">
          <Accordion.Control>進階設定（可選，不填會使用預設）</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <Card withBorder radius="md" padding="md">
                <Stack gap="sm">
                  <Group align="center" justify="space-between">
                    <Title order={5}>{t("livingVariableTitle")}</Title>
                    <Badge variant="light">{t("livingOptional")}</Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {t("livingVariableHint")}
                  </Text>
                  <NumberInput
                    label={`${t("livingVariableAmount")}（可選）`}
                    min={0}
                    value={livingSpend.variable.amount === 0 ? "" : livingSpend.variable.amount}
                    onChange={(value) => updateVariable({ amount: toNumber(value) })}
                  />
                </Stack>
              </Card>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {categoryFields.map((field) => (
                  <NumberInput
                    key={field.key}
                    label={`${field.label}（可選）`}
                    min={0}
                    value={livingSpend.categoryBreakdown.categories[field.key]}
                    disabled={!livingSpend.categoryBreakdown.enabled}
                    onChange={(value) => updateCategoryAmount(field.key, toNumber(value))}
                  />
                ))}
              </SimpleGrid>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group align="center" justify="space-between">
            <Title order={5}>{t("livingTravelTitle")}</Title>
            <Badge variant="light">{t("livingOptional")}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t("livingTravelHint")}
          </Text>
          <SegmentedControl
            value={livingSpend.travel.mode}
            onChange={(value) =>
              updateAnnualExpense("travel", {
                mode: value === "annual" ? "annual" : "monthly",
              })
            }
            data={[
              { label: t("livingModeMonthly"), value: "monthly" },
              { label: t("livingModeAnnual"), value: "annual" },
            ]}
          />
          {livingSpend.travel.mode === "monthly" ? (
            <NumberInput
              label={t("livingTravelMonthlyAmount")}
              min={0}
              value={livingSpend.travel.monthlyAmount}
              onChange={(value) =>
                updateAnnualExpense("travel", { monthlyAmount: toNumber(value) })
              }
            />
          ) : (
            <Stack gap="sm">
              <NumberInput
                label={t("livingTravelAnnualAmount")}
                min={0}
                value={livingSpend.travel.annualAmount}
                onChange={(value) =>
                  updateAnnualExpense("travel", { annualAmount: toNumber(value) })
                }
              />
              <MultiSelect
                label={t("livingTravelMonths")}
                placeholder={t("livingMonthsPlaceholder")}
                data={monthOptions}
                searchable
                value={livingSpend.travel.months}
                error={errors.travel.months}
                onChange={(value) =>
                  updateAnnualExpense("travel", { months: value })
                }
              />
              <Text size="xs" c="dimmed">
                {t("livingTravelMonthsHint")}
              </Text>
            </Stack>
          )}
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group align="center" justify="space-between">
            <Title order={5}>{t("livingTaxTitle")}</Title>
            <Badge variant="light">{t("livingOptional")}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t("livingTaxHint")}
          </Text>
          <SegmentedControl
            value={livingSpend.tax.mode}
            onChange={(value) =>
              updateAnnualExpense("tax", {
                mode: value === "annual" ? "annual" : "monthly",
              })
            }
            data={[
              { label: t("livingModeMonthly"), value: "monthly" },
              { label: t("livingModeAnnual"), value: "annual" },
            ]}
          />
          {livingSpend.tax.mode === "monthly" ? (
            <NumberInput
              label={t("livingTaxMonthlyAmount")}
              min={0}
              value={livingSpend.tax.monthlyAmount}
              onChange={(value) =>
                updateAnnualExpense("tax", { monthlyAmount: toNumber(value) })
              }
            />
          ) : (
            <Stack gap="sm">
              <NumberInput
                label={t("livingTaxAnnualAmount")}
                min={0}
                value={livingSpend.tax.annualAmount}
                onChange={(value) =>
                  updateAnnualExpense("tax", { annualAmount: toNumber(value) })
                }
              />
              <MultiSelect
                label={t("livingTaxMonths")}
                placeholder={t("livingMonthsPlaceholder")}
                data={monthOptions}
                searchable
                value={livingSpend.tax.months}
                error={errors.tax.months}
                onChange={(value) => updateAnnualExpense("tax", { months: value })}
              />
              <Text size="xs" c="dimmed">
                {t("livingTaxMonthsHint")}
              </Text>
            </Stack>
          )}
        </Stack>
      </Card>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group align="center" justify="space-between">
            <Title order={5}>{t("livingOtherFixedTitle")}</Title>
            <Badge variant="light">{t("livingOptional")}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t("livingOtherFixedHint")}
          </Text>
          <Button
            size="xs"
            onClick={() =>
              onChange({
                ...livingSpend,
                otherFixed: [
                  ...livingSpend.otherFixed,
                  {
                    id: `living-${nanoid(6)}`,
                    label: "",
                    amount: 0,
                    startMonth: baseMonth,
                    endMonth: "",
                  },
                ],
              })
            }
          >
            {t("livingOtherFixedAdd")}
          </Button>
          {livingSpend.otherFixed.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t("livingOtherFixedEmpty")}
            </Text>
          ) : (
            <Stack gap="sm">
              {livingSpend.otherFixed.map((item, index) => {
                const entryErrors = errors.otherFixed[item.id] ?? {};
                return (
                  <Card key={item.id} withBorder radius="md" padding="md">
                    <Stack gap="sm">
                      <Group justify="space-between" align="center">
                        <Text fw={600}>
                          {t("livingOtherFixedItem", { index: index + 1 })}
                        </Text>
                        <Button
                          variant="subtle"
                          color="red"
                          size="xs"
                          onClick={() => removeOtherFixed(item.id)}
                        >
                          {t("livingOtherFixedRemove")}
                        </Button>
                      </Group>
                      <TextInput
                        label={t("livingOtherFixedLabel")}
                        placeholder={t("livingOtherFixedLabelPlaceholder")}
                        value={item.label}
                        error={entryErrors.label}
                        onChange={(event) =>
                          updateOtherFixed(item.id, {
                            label: event.currentTarget.value,
                          })
                        }
                      />
                      <NumberInput
                        label={t("livingOtherFixedAmount")}
                        min={0}
                        value={item.amount}
                        error={entryErrors.amount}
                        onChange={(value) =>
                          updateOtherFixed(item.id, { amount: toNumber(value) })
                        }
                      />
                      <Group grow align="flex-start">
                        <MonthField
                          label={t("livingOtherFixedStartMonth")}
                          placeholder={t("monthPlaceholder")}
                          value={item.startMonth ?? ""}
                          error={entryErrors.startMonth}
                          onChange={(value) =>
                            updateOtherFixed(item.id, { startMonth: value })
                          }
                        />
                        <MonthField
                          label={t("livingOtherFixedEndMonth")}
                          placeholder={t("monthPlaceholder")}
                          value={item.endMonth ?? ""}
                          error={entryErrors.endMonth}
                          onChange={(value) =>
                            updateOtherFixed(item.id, { endMonth: value })
                          }
                        />
                      </Group>
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Card>

      <Divider />
      <Text size="xs" c="dimmed">
        {t("livingOptionalHint")}
      </Text>
    </Stack>
  );
}
