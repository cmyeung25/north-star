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
  OnboardingBudgetRuleDraft,
  OnboardingMemberDraft,
} from "../../../domain/onboarding/applyDraft";
import type { BudgetCategory } from "../../../store/scenarioStore";
import DateOrAgeBasisPicker, {
  type DateOrAgeBasis,
} from "../../../../components/DateOrAgeBasisPicker";

interface StepBudgetRulesProps {
  rules: OnboardingBudgetRuleDraft[];
  members: OnboardingMemberDraft[];
  errors: Record<string, string>;
  baseMonth: string;
  onAddRule: () => void;
  onUpdateRule: (id: string, patch: Partial<OnboardingBudgetRuleDraft>) => void;
  onRemoveRule: (id: string) => void;
  t: (key: string) => string;
}

const categoryOptions = [
  { value: "baseline", labelKey: "categoryBaseline" },
  { value: "health", labelKey: "categoryHealth" },
  { value: "childcare", labelKey: "categoryChildcare" },
  { value: "education", labelKey: "categoryEducation" },
  { value: "eldercare", labelKey: "categoryEldercare" },
  { value: "petcare", labelKey: "categoryPetcare" },
];

export default function StepBudgetRules({
  rules,
  members,
  errors,
  baseMonth,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  t,
}: StepBudgetRulesProps) {

  const memberOptions = [
    { value: "household", label: t("householdShared") },
    ...members.map((member) => ({ value: member.id, label: member.name })),
  ];
  const [basisByRuleId, setBasisByRuleId] = useState<Record<string, DateOrAgeBasis>>(
    {}
  );

  useEffect(() => {
    setBasisByRuleId((current) => {
      const next = { ...current };
      rules.forEach((rule) => {
        if (!next[rule.id]) {
          next[rule.id] =
            rule.startMonth?.trim() || rule.endMonth?.trim() ? "month" : "age";
        }
      });
      Object.keys(next).forEach((ruleId) => {
        if (!rules.some((rule) => rule.id === ruleId)) {
          delete next[ruleId];
        }
      });
      return next;
    });
  }, [rules]);
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={4}>{t("budgetTitle")}</Title>
        <Text size="sm" c="dimmed">
          {t("budgetDescription")}
        </Text>
      </Stack>

      <Button variant="outline" onClick={onAddRule}>
        {t("addBudgetRule")}
      </Button>

      <Stack gap="md">
        {rules.map((rule) => (
          <Card key={rule.id} withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{rule.name || t("budgetRule")}</Text>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={() => onRemoveRule(rule.id)}
                >
                  {t("remove")}
                </Button>
              </Group>
              <Group grow align="flex-start">
                <TextInput
                  label={t("ruleName")}
                  value={rule.name}
                  onChange={(event) =>
                    onUpdateRule(rule.id, { name: event.currentTarget.value })
                  }
                  error={errors[`rule.${rule.id}.name`]}
                />
                <Select
                  label={t("category")}
                  data={categoryOptions.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  }))}
                  value={rule.category}
                  onChange={(value) =>
                    onUpdateRule(rule.id, {
                      category: (value ?? "baseline") as BudgetCategory,
                    })
                  }
                />
              </Group>
              <Group grow align="flex-start">
                <Select
                  label={t("belongsTo")}
                  data={memberOptions}
                  value={rule.memberId ?? "household"}
                  onChange={(value) => {
                    onUpdateRule(rule.id, { memberId: value });
                    const isHousehold = !value || value === "household";
                    if (isHousehold) {
                      setBasisByRuleId((current) => ({
                        ...current,
                        [rule.id]: "month",
                      }));
                      if (!rule.startMonth?.trim()) {
                        onUpdateRule(rule.id, { startMonth: baseMonth });
                      }
                    }
                  }}
                  error={errors[`rule.${rule.id}.memberId`]}
                />
                <NumberInput
                  label={t("monthlyAmount")}
                  min={0}
                  value={rule.monthlyAmount}
                  onChange={(value) =>
                    onUpdateRule(rule.id, { monthlyAmount: Number(value) })
                  }
                  error={errors[`rule.${rule.id}.monthlyAmount`]}
                />
              </Group>
              {(() => {
                const hasMember = Boolean(rule.memberId && rule.memberId !== "household");
                const disableAge = !hasMember;
                const basis = disableAge
                  ? "month"
                  : basisByRuleId[rule.id] ??
                    (rule.startMonth?.trim() || rule.endMonth?.trim()
                      ? "month"
                      : "age");

                return (
                  <>
                    <DateOrAgeBasisPicker
                      value={disableAge ? "month" : basis}
                      onChange={(value) => {
                        setBasisByRuleId((current) => ({
                          ...current,
                          [rule.id]: value,
                        }));
                        if (value === "age") {
                          onUpdateRule(rule.id, { startMonth: "", endMonth: "" });
                          onUpdateRule(rule.id, {
                            ageBand: rule.ageBand ?? { fromYears: 0, toYears: 120 },
                          });
                        } else {
                          onUpdateRule(rule.id, {
                            startMonth: rule.startMonth?.trim() || baseMonth,
                          });
                        }
                      }}
                      monthLabel={t("basisMonth")}
                      ageLabel={t("basisAge")}
                      disableAge={disableAge}
                    />
                    {disableAge && (
                      <Text size="xs" c="dimmed">
                        {t("basisAgeDisabled")}
                      </Text>
                    )}
                    <Group grow align="flex-start">
                      {disableAge || basis === "month" ? (
                        <>
                          <TextInput
                            label={t("startMonth")}
                            placeholder="YYYY-MM"
                            value={rule.startMonth ?? ""}
                            onChange={(event) =>
                              onUpdateRule(rule.id, {
                                startMonth: event.currentTarget.value,
                              })
                            }
                            error={errors[`rule.${rule.id}.startMonth`]}
                          />
                          <TextInput
                            label={t("endMonth")}
                            placeholder="YYYY-MM"
                            value={rule.endMonth ?? ""}
                            onChange={(event) =>
                              onUpdateRule(rule.id, {
                                endMonth: event.currentTarget.value,
                              })
                            }
                            error={errors[`rule.${rule.id}.endMonth`]}
                          />
                        </>
                      ) : (
                        <>
                          <NumberInput
                            label={t("ageFrom")}
                            min={0}
                            value={rule.ageBand?.fromYears ?? ""}
                            onChange={(value) =>
                              onUpdateRule(rule.id, {
                                ageBand: {
                                  fromYears: Number(value),
                                  toYears: rule.ageBand?.toYears ?? 0,
                                },
                              })
                            }
                            error={errors[`rule.${rule.id}.ageFrom`]}
                          />
                          <NumberInput
                            label={t("ageTo")}
                            min={0}
                            value={rule.ageBand?.toYears ?? ""}
                            onChange={(value) =>
                              onUpdateRule(rule.id, {
                                ageBand: {
                                  fromYears: rule.ageBand?.fromYears ?? 0,
                                  toYears: Number(value),
                                },
                              })
                            }
                            error={errors[`rule.${rule.id}.ageTo`]}
                          />
                        </>
                      )}
                    </Group>
                    <Group grow align="flex-start">
                      <NumberInput
                        label={t("annualGrowth")}
                        min={0}
                        max={50}
                        step={0.1}
                        value={rule.annualGrowthPct ?? 0}
                        onChange={(value) =>
                          onUpdateRule(rule.id, { annualGrowthPct: Number(value) })
                        }
                      />
                    </Group>
                  </>
                );
              })()}
              <Text size="xs" c="dimmed">
                {t("budgetRuleHint")}
              </Text>
            </Stack>
          </Card>
        ))}
      </Stack>

    </Stack>
  );
}
