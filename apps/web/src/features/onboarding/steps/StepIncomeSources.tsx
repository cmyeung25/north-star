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
import type {
  OnboardingIncomeDraft,
  OnboardingMemberDraft,
} from "../../../domain/onboarding/applyDraft";
import type { IncomeSubtype } from "../../timeline/schema";

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
              <Group grow align="flex-start">
                <TextInput
                  label={t("startMonth")}
                  placeholder="YYYY-MM"
                  value={income.startMonth ?? ""}
                  onChange={(event) =>
                    onUpdateIncome(income.id, { startMonth: event.currentTarget.value })
                  }
                  error={errors[`income.${income.id}.startMonth`]}
                />
                <TextInput
                  label={t("endMonth")}
                  placeholder="YYYY-MM"
                  value={income.endMonth ?? ""}
                  onChange={(event) =>
                    onUpdateIncome(income.id, { endMonth: event.currentTarget.value })
                  }
                  error={errors[`income.${income.id}.endMonth`]}
                />
                <NumberInput
                  label={t("endAtAge")}
                  min={0}
                  value={income.endAtAgeYears ?? ""}
                  onChange={(value) =>
                    onUpdateIncome(income.id, { endAtAgeYears: Number(value) })
                  }
                />
              </Group>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
