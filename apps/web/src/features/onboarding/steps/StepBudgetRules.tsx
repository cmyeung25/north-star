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
  OnboardingBudgetRuleDraft,
  OnboardingMemberDraft,
} from "../../../domain/onboarding/applyDraft";
import type { BudgetCategory } from "../../../store/scenarioStore";
import NetWorthChart from "../../../../features/overview/components/NetWorthChart";
import type { TimeSeriesPoint } from "../../../../features/overview/types";
import DateOrAgeBasisPicker from "../../../../components/DateOrAgeBasisPicker";

interface StepBudgetRulesProps {
  rules: OnboardingBudgetRuleDraft[];
  members: OnboardingMemberDraft[];
  previewSeries: TimeSeriesPoint[];
  errors: Record<string, string>;
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
  previewSeries,
  errors,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  t,
}: StepBudgetRulesProps) {
  const memberOptions = [
    { value: "household", label: t("householdShared") },
    ...members.map((member) => ({ value: member.id, label: member.name })),
  ];

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
                  onChange={(value) => onUpdateRule(rule.id, { memberId: value })}
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
                const basis =
                  hasMember && (rule.startMonth || rule.endMonth) ? "month" : "age";
                const disableAge = !hasMember;

                return (
                  <>
                    <DateOrAgeBasisPicker
                      value={disableAge ? "month" : basis}
                      onChange={(value) => {
                        if (value === "age") {
                          onUpdateRule(rule.id, { startMonth: "", endMonth: "" });
                        } else {
                          onUpdateRule(rule.id, {
                            ageBand: { fromYears: 0, toYears: 120 },
                          });
                        }
                      }}
                      monthLabel={t("basisMonth")}
                      ageLabel={t("basisAge")}
                      disableAge={disableAge}
                    />
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

      <Stack gap="sm">
        <Title order={5}>{t("budgetPreview")}</Title>
        {previewSeries.length > 0 ? (
          <NetWorthChart data={previewSeries} title={t("budgetPreviewTitle")} />
        ) : (
          <Text size="sm" c="dimmed">
            {t("budgetPreviewEmpty")}
          </Text>
        )}
        <Text size="xs" c="dimmed">
          {t("budgetRulesNote")}
        </Text>
      </Stack>
    </Stack>
  );
}
