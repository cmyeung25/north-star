"use client";

import {
  Button,
  Divider,
  Drawer,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import MonthField from "../../components/MonthField";
import type { InsuranceEvent } from "../../src/domain/scenarioV2/events";
import { isValidMonthKey } from "../../src/utils/monthKey";

export type InsurancePolicyDraft = {
  id: string;
  name: string;
  kind: "protection" | "savings";
  startMonth: string;
  endMonth: string;
  premiumMonthly: string;
  premiumAnnualGrowthPct: string;
  cashValue: string;
  expectedAnnualReturnPct: string;
  policyId: string;
  policyAssetId: string;
};

export type InsuranceEventDraft = {
  id?: string;
  label: string;
  mode: "quick" | "detailed";
  startMonth: string;
  endMonth: string;
  premiumMonthly: string;
  premiumAnnualGrowthPct: string;
  policies: InsurancePolicyDraft[];
  memberId: string;
};

type InsuranceEventDrawerProps = {
  opened: boolean;
  mode: "create" | "edit";
  baseCurrency: string;
  event: InsuranceEvent | null;
  onClose: () => void;
  onSave: (draft: InsuranceEventDraft) => void;
};

type InsurancePolicy = NonNullable<InsuranceEvent["policies"]>[number];

const buildPolicyDraft = (policy: InsurancePolicy): InsurancePolicyDraft => ({
  id: policy.id,
  name: policy.name ?? "",
  kind: policy.kind,
  startMonth: policy.startMonth ?? "",
  endMonth: policy.endMonth ?? "",
  premiumMonthly: Number.isFinite(policy.premiumMonthly)
    ? String(policy.premiumMonthly)
    : "",
  premiumAnnualGrowthPct: Number.isFinite(policy.premiumAnnualGrowthPct)
    ? String(policy.premiumAnnualGrowthPct)
    : "",
  cashValue: Number.isFinite(policy.cashValue) ? String(policy.cashValue) : "",
  expectedAnnualReturnPct: Number.isFinite(policy.expectedAnnualReturnPct)
    ? String(policy.expectedAnnualReturnPct)
    : "",
  policyId: policy.policyId ?? `policy_${nanoid(8)}`,
  policyAssetId: policy.policyAssetId ?? `asset_policy_${nanoid(8)}`,
});

const buildDraft = (event: InsuranceEvent | null): InsuranceEventDraft => {
  if (!event) {
    return {
      id: undefined,
      label: "",
      mode: "quick",
      startMonth: "",
      endMonth: "",
      premiumMonthly: "",
      premiumAnnualGrowthPct: "",
      policies: [],
      memberId: "",
    };
  }

  return {
    id: event.id,
    label: event.label ?? "",
    mode: event.mode,
    startMonth: event.startMonth ?? "",
    endMonth: event.endMonth ?? "",
    premiumMonthly: Number.isFinite(event.premiumMonthly)
      ? String(event.premiumMonthly)
      : "",
    premiumAnnualGrowthPct: Number.isFinite(event.premiumAnnualGrowthPct)
      ? String(event.premiumAnnualGrowthPct)
      : "",
    policies: (event.policies ?? []).map(buildPolicyDraft),
    memberId: event.memberId ?? "",
  };
};

export default function InsuranceEventDrawer({
  opened,
  mode,
  baseCurrency,
  event,
  onClose,
  onSave,
}: InsuranceEventDrawerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const [draft, setDraft] = useState<InsuranceEventDraft>(() => buildDraft(event));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!opened) {
      return;
    }
    setDraft(buildDraft(event));
    setErrors({});
  }, [event, opened]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (draft.mode === "quick") {
      if (!isValidMonthKey(draft.startMonth)) {
        nextErrors.startMonth = t("ledgerEventStartRequired");
      }
      const premiumValue = Number(draft.premiumMonthly);
      if (!Number.isFinite(premiumValue) || premiumValue <= 0) {
        nextErrors.premiumMonthly = t("ledgerEventAmountRequired");
      }
    } else {
      if (draft.policies.length === 0) {
        nextErrors.policies = t("insurancePoliciesRequired");
      }
      draft.policies.forEach((policy, index) => {
        if (!isValidMonthKey(policy.startMonth)) {
          nextErrors[`policyStartMonth-${index}`] = t("ledgerEventStartRequired");
        }
        const premiumValue = Number(policy.premiumMonthly);
        if (!Number.isFinite(premiumValue) || premiumValue <= 0) {
          nextErrors[`policyPremium-${index}`] = t("ledgerEventAmountRequired");
        }
        if (policy.kind === "savings" && policy.cashValue) {
          const cashValue = Number(policy.cashValue);
          if (!Number.isFinite(cashValue) || cashValue < 0) {
            nextErrors[`policyCash-${index}`] = t("ledgerEventAmountRequired");
          }
        }
      });
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePolicyChange = (
    id: string,
    patch: Partial<InsurancePolicyDraft>
  ) => {
    setDraft((current) => ({
      ...current,
      policies: current.policies.map((policy) =>
        policy.id === id ? { ...policy, ...patch } : policy
      ),
    }));
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }
    onSave({
      ...draft,
      label: draft.label.trim(),
      endMonth: draft.endMonth || "",
      premiumAnnualGrowthPct: draft.premiumAnnualGrowthPct || "",
      policies: draft.policies.filter(
        (policy) => policy.name || policy.premiumMonthly || policy.startMonth
      ),
    });
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={
        mode === "edit"
          ? t("ledgerEventEditTitle")
          : t("ledgerEventCreateTitle")
      }
    >
      <Stack gap="md">
        <TextInput
          label={t("ledgerEventLabel")}
          value={draft.label}
          onChange={(eventValue) =>
            setDraft((current) => ({ ...current, label: eventValue.currentTarget.value }))
          }
        />
        <SegmentedControl
          data={[
            { value: "quick", label: t("insuranceModeQuick") },
            { value: "detailed", label: t("insuranceModeDetailed") },
          ]}
          value={draft.mode}
          onChange={(value) =>
            setDraft((current) => ({ ...current, mode: value as "quick" | "detailed" }))
          }
        />

        {draft.mode === "quick" ? (
          <>
            <MonthField
              label={t("ledgerEventStartMonth")}
              value={draft.startMonth}
              error={errors.startMonth}
              onChange={(value) =>
                setDraft((current) => ({ ...current, startMonth: value }))
              }
            />
            <MonthField
              label={t("ledgerEventEndMonth")}
              value={draft.endMonth}
              onChange={(value) => setDraft((current) => ({ ...current, endMonth: value }))}
            />
            <NumberInput
              label={t("insurancePremiumLabel", { currency: baseCurrency })}
              value={draft.premiumMonthly ? Number(draft.premiumMonthly) : ""}
              error={errors.premiumMonthly}
              min={0}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  premiumMonthly: value === "" ? "" : String(value),
                }))
              }
            />
            <NumberInput
              label={t("insurancePremiumGrowthLabel")}
              value={
                draft.premiumAnnualGrowthPct ? Number(draft.premiumAnnualGrowthPct) : ""
              }
              min={0}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  premiumAnnualGrowthPct: value === "" ? "" : String(value),
                }))
              }
            />
          </>
        ) : (
          <>
            {errors.policies && (
              <Text size="sm" c="red">
                {errors.policies}
              </Text>
            )}
            {draft.policies.map((policy, index) => (
              <Stack key={policy.id} gap="sm">
                <Divider label={t("insurancePolicyTitle", { index: index + 1 })} />
                <TextInput
                  label={t("insurancePolicyNameLabel")}
                  value={policy.name}
                  onChange={(eventValue) =>
                    handlePolicyChange(policy.id, { name: eventValue.currentTarget.value })
                  }
                />
                <SegmentedControl
                  data={[
                    { value: "protection", label: t("insurancePolicyProtection") },
                    { value: "savings", label: t("insurancePolicySavings") },
                  ]}
                  value={policy.kind}
                  onChange={(value) =>
                    handlePolicyChange(policy.id, {
                      kind: value as InsurancePolicyDraft["kind"],
                    })
                  }
                />
                <MonthField
                  label={t("ledgerEventStartMonth")}
                  value={policy.startMonth}
                  error={errors[`policyStartMonth-${index}`]}
                  onChange={(value) => handlePolicyChange(policy.id, { startMonth: value })}
                />
                <MonthField
                  label={t("ledgerEventEndMonth")}
                  value={policy.endMonth}
                  onChange={(value) => handlePolicyChange(policy.id, { endMonth: value })}
                />
                <NumberInput
                  label={t("insurancePremiumLabel", { currency: baseCurrency })}
                  value={policy.premiumMonthly ? Number(policy.premiumMonthly) : ""}
                  error={errors[`policyPremium-${index}`]}
                  min={0}
                  onChange={(value) =>
                    handlePolicyChange(policy.id, {
                      premiumMonthly: value === "" ? "" : String(value),
                    })
                  }
                />
                <NumberInput
                  label={t("insurancePremiumGrowthLabel")}
                  value={
                    policy.premiumAnnualGrowthPct
                      ? Number(policy.premiumAnnualGrowthPct)
                      : ""
                  }
                  min={0}
                  onChange={(value) =>
                    handlePolicyChange(policy.id, {
                      premiumAnnualGrowthPct: value === "" ? "" : String(value),
                    })
                  }
                />
                {policy.kind === "savings" && (
                  <>
                    <NumberInput
                      label={t("insuranceCashValueLabel", { currency: baseCurrency })}
                      value={policy.cashValue ? Number(policy.cashValue) : ""}
                      error={errors[`policyCash-${index}`]}
                      min={0}
                      onChange={(value) =>
                        handlePolicyChange(policy.id, {
                          cashValue: value === "" ? "" : String(value),
                        })
                      }
                    />
                    <NumberInput
                      label={t("insuranceReturnLabel")}
                      value={
                        policy.expectedAnnualReturnPct
                          ? Number(policy.expectedAnnualReturnPct)
                          : ""
                      }
                      min={0}
                      onChange={(value) =>
                        handlePolicyChange(policy.id, {
                          expectedAnnualReturnPct: value === "" ? "" : String(value),
                        })
                      }
                    />
                  </>
                )}
                <Group justify="flex-end">
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        policies: current.policies.filter(
                          (entry) => entry.id !== policy.id
                        ),
                      }))
                    }
                  >
                    {common("actionDelete")}
                  </Button>
                </Group>
              </Stack>
            ))}
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  policies: [
                    ...current.policies,
                    {
                      id: nanoid(),
                      name: "",
                      kind: "protection",
                      startMonth: draft.startMonth,
                      endMonth: "",
                      premiumMonthly: "",
                      premiumAnnualGrowthPct: "",
                      cashValue: "",
                      expectedAnnualReturnPct: "",
                      policyId: `policy_${nanoid(8)}`,
                      policyAssetId: `asset_policy_${nanoid(8)}`,
                    },
                  ],
                }))
              }
            >
              {t("insurancePolicyAdd")}
            </Button>
          </>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            {common("actionCancel")}
          </Button>
          <Button onClick={handleSave}>{common("actionSave")}</Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
