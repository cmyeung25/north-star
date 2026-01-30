"use client";

import {
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
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
  OnboardingV2DraftInsurance,
  OnboardingV2DraftMember,
} from "../../../domain/onboarding/v2/mapOnboardingV2DraftToScenario";

export type InsuranceErrors = {
  quick: Partial<{ amount: string; startMonth: string; endMonth: string }>;
  policies: Record<
    string,
    Partial<{
      premiumPerMonth: string;
      startMonth: string;
      endMonth: string;
      cashValue: string;
      returnPct: string;
    }>
  >;
};

type InsuranceStepProps = {
  insurance: OnboardingV2DraftInsurance;
  baseMonth: string;
  members: OnboardingV2DraftMember[];
  errors: InsuranceErrors;
  onChange: (next: OnboardingV2DraftInsurance) => void;
  t: (key: string, values?: Record<string, number>) => string;
};

const resolveNextPolicyId = (policies: OnboardingV2DraftInsurance["policies"]) => {
  const maxId = policies.reduce((acc, policy) => {
    const match = /policy-(\d+)/.exec(policy.id);
    if (!match) {
      return acc;
    }
    const value = Number(match[1]);
    return Number.isFinite(value) ? Math.max(acc, value) : acc;
  }, 0);
  return `policy-${maxId + 1}`;
};

export default function InsuranceStep({
  insurance,
  baseMonth,
  members,
  errors,
  onChange,
  t,
}: InsuranceStepProps) {
  const memberOptions = useMemo(
    () => [
      { value: "", label: t("insuranceMemberOptional") },
      ...members.map((member) => ({
        value: member.id,
        label: member.name?.trim() || member.id,
      })),
    ],
    [members, t]
  );

  const updateInsurance = (patch: Partial<OnboardingV2DraftInsurance>) => {
    onChange({
      ...insurance,
      ...patch,
    });
  };

  const updateQuick = (
    patch: Partial<OnboardingV2DraftInsurance["quick"]>
  ) => {
    updateInsurance({
      quick: {
        ...insurance.quick,
        ...patch,
      },
    });
  };

  const updatePolicy = (
    id: string,
    patch: Partial<OnboardingV2DraftInsurance["policies"][number]>
  ) => {
    updateInsurance({
      policies: insurance.policies.map((policy) =>
        policy.id === id ? { ...policy, ...patch } : policy
      ),
    });
  };

  const addPolicy = () => {
    updateInsurance({
      policies: [
        ...insurance.policies,
        {
          id: resolveNextPolicyId(insurance.policies),
          name: "",
          type: "protection",
          premiumPerMonth: 0,
          startMonth: baseMonth,
          endMonth: "",
          memberId: "",
          cashValue: null,
          cashValueKnown: true,
          returnPct: null,
        },
      ],
    });
  };

  const removePolicy = (id: string) => {
    updateInsurance({
      policies: insurance.policies.filter((policy) => policy.id !== id),
    });
  };

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Title order={4}>{t("insuranceTitle")}</Title>
          <Text size="sm" c="dimmed">
            {t("insuranceHint")}
          </Text>
          <SegmentedControl
            value={insurance.mode}
            onChange={(value) =>
              updateInsurance({
                mode: value === "quick" ? "quick" : "detailed",
              })
            }
            data={[
              { value: "quick", label: t("insuranceModeQuick") },
              { value: "detailed", label: t("insuranceModeDetailed") },
            ]}
          />
        </Stack>
      </Card>

      {insurance.mode === "quick" ? (
        <Card withBorder radius="md" padding="md">
          <Stack gap="sm">
            <Group align="center" justify="space-between">
              <Title order={5}>{t("insuranceQuickTitle")}</Title>
              <Badge variant="light">{t("insuranceQuickBadge")}</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {t("insuranceQuickHint")}
            </Text>
            <Group grow align="flex-start">
              <NumberInput
                label={t("insuranceQuickAmount")}
                min={0}
                value={insurance.quick.amount}
                error={errors.quick.amount}
                onChange={(value) =>
                  updateQuick({
                    amount: typeof value === "number" ? value : 0,
                  })
                }
              />
              <MonthField
                label={t("insuranceQuickStartMonth")}
                placeholder={t("monthPlaceholder")}
                value={insurance.quick.startMonth ?? ""}
                error={errors.quick.startMonth}
                onChange={(value) => updateQuick({ startMonth: value })}
              />
              <MonthField
                label={t("insuranceQuickEndMonth")}
                placeholder={t("monthPlaceholder")}
                value={insurance.quick.endMonth ?? ""}
                error={errors.quick.endMonth}
                onChange={(value) => updateQuick({ endMonth: value })}
              />
            </Group>
          </Stack>
        </Card>
      ) : (
        <Card withBorder radius="md" padding="md">
          <Stack gap="sm">
            <Group align="center" justify="space-between">
              <Title order={5}>{t("insuranceDetailedTitle")}</Title>
              <Badge variant="light">{t("insuranceDetailedBadge")}</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {t("insuranceDetailedHint")}
            </Text>
            <Button size="xs" onClick={addPolicy}>
              {t("insurancePolicyAdd")}
            </Button>
            {insurance.policies.length === 0 ? (
              <Text size="sm" c="dimmed">
                {t("insurancePolicyEmpty")}
              </Text>
            ) : (
              <Stack gap="sm">
                {insurance.policies.map((policy, index) => {
                  const entryErrors = errors.policies[policy.id];
                  const showSavingsFields = policy.type === "savings";
                  const cashValueMissing =
                    showSavingsFields && !policy.cashValueKnown;
                  return (
                    <Card key={policy.id} withBorder radius="md" padding="sm">
                      <Stack gap="xs">
                        <Group align="center" justify="space-between">
                          <Text fw={600}>
                            {t("insurancePolicyItem", { index: index + 1 })}
                          </Text>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => removePolicy(policy.id)}
                          >
                            {t("insurancePolicyRemove")}
                          </Button>
                        </Group>
                        <Group grow align="flex-start">
                          <TextInput
                            label={t("insurancePolicyName")}
                            placeholder={t("insurancePolicyNamePlaceholder")}
                            value={policy.name ?? ""}
                            onChange={(event) =>
                              updatePolicy(policy.id, {
                                name: event.currentTarget.value,
                              })
                            }
                          />
                          <Select
                            label={t("insuranceMember")}
                            data={memberOptions}
                            value={policy.memberId ?? ""}
                            onChange={(value) =>
                              updatePolicy(policy.id, { memberId: value ?? "" })
                            }
                          />
                        </Group>
                        <Group grow align="flex-start">
                          <SegmentedControl
                            value={policy.type}
                            onChange={(value) =>
                              updatePolicy(policy.id, {
                                type: value === "savings" ? "savings" : "protection",
                              })
                            }
                            data={[
                              {
                                value: "protection",
                                label: t("insurancePolicyTypeProtection"),
                              },
                              {
                                value: "savings",
                                label: t("insurancePolicyTypeSavings"),
                              },
                            ]}
                          />
                          <NumberInput
                            label={t("insurancePremiumPerMonth")}
                            min={0}
                            value={policy.premiumPerMonth}
                            error={entryErrors?.premiumPerMonth}
                            onChange={(value) =>
                              updatePolicy(policy.id, {
                                premiumPerMonth: typeof value === "number" ? value : 0,
                              })
                            }
                          />
                        </Group>
                        <Group grow align="flex-start">
                          <MonthField
                            label={t("insuranceStartMonth")}
                            placeholder={t("monthPlaceholder")}
                            value={policy.startMonth ?? ""}
                            error={entryErrors?.startMonth}
                            onChange={(value) =>
                              updatePolicy(policy.id, { startMonth: value })
                            }
                          />
                          <MonthField
                            label={t("insuranceEndMonth")}
                            placeholder={t("monthPlaceholder")}
                            value={policy.endMonth ?? ""}
                            error={entryErrors?.endMonth}
                            onChange={(value) =>
                              updatePolicy(policy.id, { endMonth: value })
                            }
                          />
                        </Group>
                        {showSavingsFields ? (
                          <Stack gap="xs">
                            <Group align="center" justify="space-between">
                              <Text fw={500}>{t("insuranceSavingsTitle")}</Text>
                              {cashValueMissing ? (
                                <Badge variant="light" color="yellow">
                                  {t("insuranceCashValueMissing")}
                                </Badge>
                              ) : null}
                            </Group>
                            <Group grow align="flex-start">
                              <NumberInput
                                label={t("insuranceCashValue")}
                                min={0}
                                value={policy.cashValue ?? ""}
                                error={entryErrors?.cashValue}
                                disabled={!policy.cashValueKnown}
                                onChange={(value) =>
                                  updatePolicy(policy.id, {
                                    cashValue: typeof value === "number" ? value : null,
                                  })
                                }
                              />
                              <NumberInput
                                label={t("insuranceReturnPct")}
                                min={0}
                                value={policy.returnPct ?? ""}
                                error={entryErrors?.returnPct}
                                onChange={(value) =>
                                  updatePolicy(policy.id, {
                                    returnPct: typeof value === "number" ? value : null,
                                  })
                                }
                                rightSection="%"
                              />
                            </Group>
                            <Switch
                              label={t("insuranceCashValueUnknown")}
                              checked={!policy.cashValueKnown}
                              onChange={(event) =>
                                updatePolicy(policy.id, {
                                  cashValueKnown: !event.currentTarget.checked,
                                  cashValue: event.currentTarget.checked
                                    ? null
                                    : policy.cashValue ?? null,
                                })
                              }
                            />
                          </Stack>
                        ) : null}
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
