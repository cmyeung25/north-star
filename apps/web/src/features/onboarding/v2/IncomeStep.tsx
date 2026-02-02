"use client";

import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMemo } from "react";
import MonthField from "../../../../components/MonthField";
import type {
  OnboardingV2DraftIncome,
  OnboardingV2DraftMember,
  OnboardingV2IncomeFrequency,
} from "../../../domain/onboarding/v2/draftTypes";

type IncomeFieldErrors = Partial<{
  label: string;
  amount: string;
  startMonth: string;
  endMonth: string;
}>;

type IncomeStepProps = {
  incomes: OnboardingV2DraftIncome[];
  members: OnboardingV2DraftMember[];
  baseMonth: string;
  errors: Record<string, IncomeFieldErrors>;
  onChange: (next: OnboardingV2DraftIncome[]) => void;
  t: (key: string, values?: Record<string, number>) => string;
};

const frequencyOptions: { value: OnboardingV2IncomeFrequency; label: string }[] =
  [
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" },
    { value: "oneOff", label: "One-off" },
  ];

const buildBlankIncome = ({
  id,
  startMonth,
}: {
  id: string;
  startMonth: string;
}): OnboardingV2DraftIncome => ({
  id,
  label: "",
  amount: 0,
  frequency: "monthly",
  startMonth,
  endMonth: "",
  memberId: "",
  followIncomeGrowth: true,
});

export default function IncomeStep({
  incomes,
  members,
  baseMonth,
  errors,
  onChange,
  t,
}: IncomeStepProps) {
  const memberOptions = useMemo(
    () => [
      { value: "", label: t("incomeMemberOptional") },
      ...members.map((member) => ({
        value: member.id,
        label: member.name?.trim() || member.id,
      })),
    ],
    [members, t]
  );

  const handleAddIncome = (next: OnboardingV2DraftIncome) => {
    onChange([...incomes, next]);
  };

  const handleUpdateIncome = (
    incomeId: string,
    patch: Partial<OnboardingV2DraftIncome>
  ) => {
    onChange(
      incomes.map((income) =>
        income.id === incomeId ? { ...income, ...patch } : income
      )
    );
  };

  const handleRemoveIncome = (incomeId: string) => {
    onChange(incomes.filter((income) => income.id !== incomeId));
  };

  const templateButtons = [
    {
      key: "selfSalary",
      label: t("incomeTemplateSelfSalary"),
      fallbackName: t("incomeTemplateSelfSalaryName"),
      memberId: "self",
    },
    {
      key: "partnerSalary",
      label: t("incomeTemplatePartnerSalary"),
      fallbackName: t("incomeTemplatePartnerSalaryName"),
      memberId: "partner",
    },
    {
      key: "rentIncome",
      label: t("incomeTemplateRent"),
      fallbackName: t("incomeTemplateRentName"),
      memberId: "",
    },
    {
      key: "commissionIncome",
      label: t("incomeTemplateCommission"),
      fallbackName: t("incomeTemplateCommissionName"),
      memberId: "",
    },
    {
      key: "bonusIncome",
      label: t("incomeTemplateBonus"),
      fallbackName: t("incomeTemplateBonusName"),
      memberId: "",
      frequency: "oneOff" as const,
      followIncomeGrowth: false,
    },
  ];

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Title order={4}>{t("incomeTitle")}</Title>
          <Text size="sm" c="dimmed">
            {t("incomeHint")}
          </Text>
          <Group gap="sm" wrap="wrap">
            {templateButtons.map((template) => {
              const hasMember =
                template.memberId === "" ||
                members.some((member) => member.id === template.memberId);
              return (
                <Button
                  key={template.key}
                  variant="light"
                  size="xs"
                  disabled={!hasMember}
                onClick={() => {
                  const id = `${template.key}-${Date.now()}`;
                  handleAddIncome({
                    ...buildBlankIncome({ id, startMonth: baseMonth }),
                    label: template.fallbackName,
                    memberId: template.memberId,
                    frequency: template.frequency ?? "monthly",
                    followIncomeGrowth: template.followIncomeGrowth ?? true,
                  });
                }}
              >
                {template.label}
              </Button>
            );
            })}
            <Button
              size="xs"
              onClick={() => {
                const id = `income-${Date.now()}`;
                handleAddIncome(buildBlankIncome({ id, startMonth: baseMonth }));
              }}
            >
              {t("incomeAdd")}
            </Button>
          </Group>
        </Stack>
      </Card>

      {incomes.length === 0 ? (
        <Card withBorder radius="md" padding="md">
          <Text size="sm" c="dimmed">
            {t("incomeEmpty")}
          </Text>
        </Card>
      ) : (
        <Stack gap="md">
          {incomes.map((income, index) => {
            const incomeErrors = errors[income.id] ?? {};
            return (
              <Card key={income.id} withBorder radius="md" padding="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <Badge variant="light">#{index + 1}</Badge>
                      <Text fw={600}>
                        {income.label?.trim() || t("incomeItemTitle")}
                      </Text>
                    </Group>
                    <Button
                      variant="subtle"
                      color="red"
                      size="xs"
                      onClick={() => handleRemoveIncome(income.id)}
                    >
                      {t("incomeRemove")}
                    </Button>
                  </Group>
                  <Group grow align="flex-start">
                    <TextInput
                      label={t("incomeName")}
                      placeholder={t("incomeNamePlaceholder")}
                      value={income.label}
                      error={incomeErrors.label}
                      onChange={(event) =>
                        handleUpdateIncome(income.id, {
                          label: event.currentTarget.value,
                        })
                      }
                    />
                    <NumberInput
                      label={t("incomeAmount")}
                      min={0}
                      value={income.amount}
                      error={incomeErrors.amount}
                      onChange={(value) =>
                        handleUpdateIncome(income.id, {
                          amount: typeof value === "number" ? value : 0,
                        })
                      }
                    />
                  </Group>
                  <Group grow align="flex-start">
                    <Select
                      label={t("incomeFrequencyLabel")}
                      data={frequencyOptions.map((option) => ({
                        value: option.value,
                        label: t(`incomeFrequency.${option.value}`),
                      }))}
                      value={income.frequency}
                      onChange={(value) =>
                        handleUpdateIncome(income.id, {
                          frequency: (value as OnboardingV2IncomeFrequency) ?? "monthly",
                        })
                      }
                    />
                    <Select
                      label={t("incomeMember")}
                      data={memberOptions}
                      value={income.memberId ?? ""}
                      onChange={(value) =>
                        handleUpdateIncome(income.id, { memberId: value ?? "" })
                      }
                    />
                  </Group>
                  <Divider />
                  <Text size="xs" c="dimmed">
                    {t("incomeAdvancedTitle")}
                  </Text>
                  <Group grow align="flex-start">
                    <MonthField
                      label={t("incomeStartMonth")}
                      placeholder={t("monthPlaceholder")}
                      value={income.startMonth ?? ""}
                      error={incomeErrors.startMonth}
                      onChange={(value) =>
                        handleUpdateIncome(income.id, {
                          startMonth: value,
                        })
                      }
                    />
                    <MonthField
                      label={t("incomeEndMonth")}
                      placeholder={t("monthPlaceholder")}
                      value={income.endMonth ?? ""}
                      error={incomeErrors.endMonth}
                      onChange={(value) =>
                        handleUpdateIncome(income.id, {
                          endMonth: value,
                        })
                      }
                      disabled={income.frequency === "oneOff"}
                    />
                  </Group>
                  <Switch
                    label={t("incomeFollowGrowth")}
                    checked={income.followIncomeGrowth}
                    disabled={income.frequency === "oneOff"}
                    onChange={(event) =>
                      handleUpdateIncome(income.id, {
                        followIncomeGrowth: event.currentTarget.checked,
                      })
                    }
                  />
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
