"use client";

import {
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { applyOnboardingToScenario } from "../../src/engine/onboardingTransforms";
import type { OnboardingDraft } from "../../src/onboarding/types";
import { getActiveScenario, useScenarioStore } from "../../src/store/scenarioStore";

const steps = ["Basics", "Income & Expenses", "Travel Budget"] as const;

type DraftErrors = Partial<Record<keyof OnboardingDraft, string>>;

export default function OnboardingClient() {
  const router = useRouter();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const replaceScenario = useScenarioStore((state) => state.replaceScenario);

  const activeScenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>({
    initialCash: 0,
    housingStatus: "rent",
    rentMonthly: 0,
    salaryMonthly: 0,
    expenseItems: [{ label: "", monthlyAmount: 0 }],
    travelAnnual: 0,
  });
  const [errors, setErrors] = useState<DraftErrors>({});

  const totalMonthlyExpenses = useMemo(
    () =>
      draft.expenseItems.reduce(
        (total, item) => total + Number(item.monthlyAmount || 0),
        0
      ),
    [draft.expenseItems]
  );

  const updateDraft = <K extends keyof OnboardingDraft>(
    key: K,
    value: OnboardingDraft[K]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateExpenseItem = (
    index: number,
    patch: Partial<OnboardingDraft["expenseItems"][number]>
  ) => {
    setDraft((current) => {
      const next = [...current.expenseItems];
      next[index] = { ...next[index], ...patch };
      return { ...current, expenseItems: next };
    });
  };

  const addExpenseItem = () => {
    setDraft((current) => ({
      ...current,
      expenseItems: [...current.expenseItems, { label: "", monthlyAmount: 0 }],
    }));
  };

  const removeExpenseItem = (index: number) => {
    setDraft((current) => ({
      ...current,
      expenseItems: current.expenseItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const validateStep = (index: number) => {
    const nextErrors: DraftErrors = {};

    if (index === 0) {
      if (draft.initialCash < 0) {
        nextErrors.initialCash = "Initial cash must be 0 or higher.";
      }
      if (draft.housingStatus === "rent") {
        if (draft.rentMonthly <= 0) {
          nextErrors.rentMonthly = "Enter a monthly rent amount.";
        }
      }
    }

    if (index === 1) {
      if (draft.salaryMonthly <= 0) {
        nextErrors.salaryMonthly = "Enter a monthly salary amount.";
      }
      if (draft.expenseItems.length === 0) {
        nextErrors.expenseItems = "Add at least one recurring expense item.";
      }
      if (draft.expenseItems.some((item) => item.monthlyAmount < 0)) {
        nextErrors.expenseItems = "Expense amounts must be 0 or higher.";
      }
    }

    if (index === 2) {
      if (draft.travelAnnual < 0) {
        nextErrors.travelAnnual = "Travel budget must be 0 or higher.";
      }
    }

    setErrors((current) => ({ ...current, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const validateAll = () => {
    const stepCount = steps.length;
    for (let index = 0; index < stepCount; index += 1) {
      if (!validateStep(index)) {
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) {
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleBack = () => {
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleSubmit = () => {
    if (!activeScenario || !validateAll()) {
      return;
    }

    const updatedScenario = applyOnboardingToScenario(activeScenario, draft);
    replaceScenario(updatedScenario);
    router.push("/overview");
  };

  if (!activeScenario) {
    return null;
  }

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2}>Welcome to North Star</Title>
        <Text size="sm" c="dimmed">
          Answer a few questions to set up your baseline plan.
        </Text>
      </Stack>

      <Card withBorder radius="md" padding="lg">
        <Stack gap="lg">
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              Step {step + 1} of {steps.length}
            </Text>
            <Title order={4}>{steps[step]}</Title>
          </Stack>

          {step === 0 && (
            <Stack gap="md">
              <NumberInput
                label="Initial cash"
                value={draft.initialCash}
                error={errors.initialCash}
                onChange={(value) => updateDraft("initialCash", Number(value ?? 0))}
                thousandSeparator=","
                min={0}
              />
              <SegmentedControl
                value={draft.housingStatus}
                onChange={(value) =>
                  updateDraft("housingStatus", value as OnboardingDraft["housingStatus"])
                }
                data={[
                  { label: "Renting", value: "rent" },
                  { label: "Owning", value: "own" },
                ]}
              />
              {draft.housingStatus === "rent" ? (
                <NumberInput
                  label="Monthly rent"
                  value={draft.rentMonthly}
                  error={errors.rentMonthly}
                  onChange={(value) =>
                    updateDraft("rentMonthly", Number(value ?? 0))
                  }
                  thousandSeparator=","
                  min={0}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  We’ll estimate a starter home position that you can refine later.
                </Text>
              )}
            </Stack>
          )}

          {step === 1 && (
            <Stack gap="md">
              <NumberInput
                label="Monthly salary"
                value={draft.salaryMonthly}
                error={errors.salaryMonthly}
                onChange={(value) =>
                  updateDraft("salaryMonthly", Number(value ?? 0))
                }
                thousandSeparator=","
                min={0}
              />
              <Stack gap="sm">
                {draft.expenseItems.map((item, index) => (
                  <Group key={`expense-item-${index}`} align="flex-end" wrap="nowrap">
                    <TextInput
                      label={index === 0 ? "Expense item" : undefined}
                      placeholder="Groceries, childcare, etc."
                      value={item.label}
                      onChange={(event) =>
                        updateExpenseItem(index, { label: event.currentTarget.value })
                      }
                      style={{ flex: 2 }}
                    />
                    <NumberInput
                      label={index === 0 ? "Monthly amount" : undefined}
                      value={item.monthlyAmount}
                      onChange={(value) =>
                        updateExpenseItem(index, {
                          monthlyAmount: Number(value ?? 0),
                        })
                      }
                      thousandSeparator=","
                      min={0}
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="subtle"
                      color="red"
                      onClick={() => removeExpenseItem(index)}
                    >
                      Remove
                    </Button>
                  </Group>
                ))}
                {errors.expenseItems && (
                  <Text size="xs" c="red">
                    {errors.expenseItems}
                  </Text>
                )}
                <Group justify="space-between">
                  <Button variant="light" onClick={addExpenseItem}>
                    Add expense item
                  </Button>
                  <Text size="sm" c="dimmed">
                    Total monthly expenses: {totalMonthlyExpenses.toLocaleString()}
                  </Text>
                </Group>
              </Stack>
            </Stack>
          )}

          {step === 2 && (
            <Stack gap="md">
              <NumberInput
                label="Annual travel budget"
                value={draft.travelAnnual}
                error={errors.travelAnnual}
                onChange={(value) =>
                  updateDraft("travelAnnual", Number(value ?? 0))
                }
                thousandSeparator=","
                min={0}
              />
              <Text size="sm" c="dimmed">
                We’ll convert this to a monthly amount in your plan.
              </Text>
            </Stack>
          )}

          <Group justify="space-between">
            <Button variant="subtle" onClick={handleBack} disabled={step === 0}>
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={handleNext}>Continue</Button>
            ) : (
              <Button onClick={handleSubmit}>Finish setup</Button>
            )}
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
