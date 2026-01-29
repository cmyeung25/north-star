import {
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import type {
  OnboardingIncomeDraft,
  OnboardingMemberDraft,
} from "../../../domain/onboarding/applyDraft";
import type { IncomeSubtype } from "../../timeline/schema";
import EndConditionPicker, { type EndConditionMode } from "../../../../components/EndConditionPicker";
import MonthField from "../../../../components/MonthField";

interface StepIncomeSourcesProps {
  incomes: OnboardingIncomeDraft[];
  members: OnboardingMemberDraft[];
  errors: Record<string, string>;
  onAddIncome: () => void;
  onUpdateIncome: (id: string, patch: Partial<OnboardingIncomeDraft>) => void;
  onRemoveIncome: (id: string) => void;
  t: (key: string) => string;
}

const incomeTypeOptions = [
  { value: "salary", labelKey: "incomeSalary" },
  { value: "bonus", labelKey: "incomeBonus" },
  { value: "freelance", labelKey: "incomeFreelance" },
  { value: "rental", labelKey: "incomeRental" },
  { value: "dividend", labelKey: "incomeDividend" },
  { value: "interest", labelKey: "incomeInterest" },
  { value: "other", labelKey: "incomeOther" },
];

export default function StepIncomeSources({
  incomes,
  members,
  errors,
  onAddIncome,
  onUpdateIncome,
  onRemoveIncome,
  t,
}: StepIncomeSourcesProps) {
  const [endConditionModes, setEndConditionModes] = useState<
    Record<string, EndConditionMode>
  >({});

  useEffect(() => {
    setEndConditionModes((current) => {
      const next = { ...current };
      incomes.forEach((income) => {
        if (!next[income.id]) {
          next[income.id] = income.endAtAgeYears ? "age" : "month";
        }
      });
      return next;
    });
  }, [incomes]);

  const memberOptions = [
    { value: "household", label: t("householdShared") },
    ...members.map((member) => ({ value: member.id, label: member.name })),
  ];

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={4}>{t("incomeTitle")}</Title>
        <Text size="sm" c="dimmed">
          {t("incomeDescription")}
        </Text>
      </Stack>

      <Button variant="outline" onClick={onAddIncome}>
        {t("addIncome")}
      </Button>

      <Stack gap="md">
        {incomes.map((income) => (
          <Card key={income.id} withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{income.title || t("incomeItem")}</Text>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={() => onRemoveIncome(income.id)}
                >
                  {t("remove")}
                </Button>
              </Group>
              <Group grow align="flex-start">
                <TextInput
                  label={t("incomeName")}
                  value={income.title}
                  onChange={(event) =>
                    onUpdateIncome(income.id, { title: event.currentTarget.value })
                  }
                  error={errors[`income.${income.id}.title`]}
                />
                <Select
                  label={t("incomeType")}
                  data={incomeTypeOptions.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  }))}
                  value={income.subtype}
                  onChange={(value) =>
                    onUpdateIncome(income.id, {
                      subtype: (value ?? "salary") as IncomeSubtype,
                    })
                  }
                />
              </Group>
              <Group grow align="flex-start">
                <Select
                  label={t("belongsTo")}
                  data={memberOptions}
                  value={income.memberId ?? ""}
                  onChange={(value) => onUpdateIncome(income.id, { memberId: value })}
                  error={errors[`income.${income.id}.memberId`]}
                />
                <NumberInput
                  label={t("monthlyAmount")}
                  min={0}
                  value={income.monthlyAmount}
                  onChange={(value) =>
                    onUpdateIncome(income.id, { monthlyAmount: Number(value) })
                  }
                  error={errors[`income.${income.id}.monthlyAmount`]}
                />
              </Group>
              <Stack gap="xs">
                <MonthField
                  label={t("startMonth")}
                  placeholder="YYYY-MM"
                  value={income.startMonth ?? ""}
                  onChange={(value) =>
                    onUpdateIncome(income.id, { startMonth: value })
                  }
                  error={errors[`income.${income.id}.startMonth`]}
                />
                <EndConditionPicker
                  mode={endConditionModes[income.id] ?? "month"}
                  onModeChange={(value) => {
                    setEndConditionModes((current) => ({
                      ...current,
                      [income.id]: value,
                    }));
                    onUpdateIncome(income.id, {
                      endMonth: value === "age" ? "" : income.endMonth ?? "",
                      endAtAgeYears: value === "month" ? undefined : income.endAtAgeYears,
                    });
                  }}
                  monthLabel={t("endMonth")}
                  monthPlaceholder="YYYY-MM"
                  monthValue={income.endMonth ?? ""}
                  monthError={errors[`income.${income.id}.endMonth`]}
                  onMonthChange={(value) =>
                    onUpdateIncome(income.id, { endMonth: value })
                  }
                  ageLabel={t("endAtAge")}
                  ageValue={income.endAtAgeYears ?? ""}
                  onAgeChange={(value) =>
                    onUpdateIncome(income.id, {
                      endAtAgeYears: typeof value === "number" ? value : undefined,
                    })
                  }
                  monthOptionLabel={t("endConditionMonth")}
                  ageOptionLabel={t("endConditionAge")}
                />
              </Stack>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
