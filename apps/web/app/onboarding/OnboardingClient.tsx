"use client";

import {
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { applyOnboardingToScenario } from "../../src/engine/onboardingTransforms";
import type { OnboardingDraft } from "../../src/onboarding/types";
import { getActiveScenario, useScenarioStore } from "../../src/store/scenarioStore";

const steps = [
  "Basics",
  "Housing",
  "Income & Expenses",
  "Annual Budgets",
  "Investments",
  "Insurance",
] as const;

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
    existingHome: {
      marketValue: 0,
      mortgageBalance: 0,
      annualRatePct: 0,
      remainingTermMonths: 360,
      holdingCostMonthly: 0,
      appreciationPct: 3,
    },
    salaryMonthly: 0,
    expenseItems: [{ label: "", monthlyAmount: 0 }],
    annualBudgetItems: [{ label: "Travel", annualAmount: 0 }],
    investments: [],
    insurances: [],
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
  const totalAnnualBudget = useMemo(
    () =>
      draft.annualBudgetItems.reduce(
        (total, item) => total + Number(item.annualAmount || 0),
        0
      ),
    [draft.annualBudgetItems]
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

  const updateAnnualBudgetItem = (
    index: number,
    patch: Partial<OnboardingDraft["annualBudgetItems"][number]>
  ) => {
    setDraft((current) => {
      const next = [...current.annualBudgetItems];
      next[index] = { ...next[index], ...patch };
      return { ...current, annualBudgetItems: next };
    });
  };

  const addAnnualBudgetItem = () => {
    setDraft((current) => ({
      ...current,
      annualBudgetItems: [
        ...current.annualBudgetItems,
        { label: "", annualAmount: 0 },
      ],
    }));
  };

  const removeAnnualBudgetItem = (index: number) => {
    setDraft((current) => ({
      ...current,
      annualBudgetItems: current.annualBudgetItems.filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));
  };

  const updateInvestment = (
    index: number,
    patch: Partial<OnboardingDraft["investments"][number]>
  ) => {
    setDraft((current) => {
      const next = [...current.investments];
      next[index] = { ...next[index], ...patch };
      return { ...current, investments: next };
    });
  };

  const addInvestment = () => {
    setDraft((current) => ({
      ...current,
      investments: [
        ...current.investments,
        { assetClass: "equity", marketValue: 0 },
      ],
    }));
  };

  const removeInvestment = (index: number) => {
    setDraft((current) => ({
      ...current,
      investments: current.investments.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateInsurance = (
    index: number,
    patch: Partial<OnboardingDraft["insurances"][number]>
  ) => {
    setDraft((current) => {
      const next = [...current.insurances];
      next[index] = { ...next[index], ...patch };
      return { ...current, insurances: next };
    });
  };

  const addInsurance = () => {
    setDraft((current) => ({
      ...current,
      insurances: [
        ...current.insurances,
        { insuranceType: "life", premiumMode: "monthly", premiumAmount: 0 },
      ],
    }));
  };

  const removeInsurance = (index: number) => {
    setDraft((current) => ({
      ...current,
      insurances: current.insurances.filter((_, itemIndex) => itemIndex !== index),
    }));
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
    }

    if (index === 1) {
      if (draft.housingStatus === "rent") {
        if (draft.rentMonthly <= 0) {
          nextErrors.rentMonthly = "Enter a monthly rent amount.";
        }
      } else {
        if (draft.existingHome.marketValue <= 0) {
          nextErrors.existingHome = "Enter a home market value.";
        }
        if (draft.existingHome.mortgageBalance < 0) {
          nextErrors.existingHome = "Mortgage balance must be 0 or higher.";
        }
        if (draft.existingHome.annualRatePct < 0) {
          nextErrors.existingHome = "Mortgage rate must be 0 or higher.";
        }
        if (draft.existingHome.remainingTermMonths < 1) {
          nextErrors.existingHome = "Remaining term must be at least 1 month.";
        }
        if (
          typeof draft.existingHome.holdingCostMonthly === "number" &&
          draft.existingHome.holdingCostMonthly < 0
        ) {
          nextErrors.existingHome = "Holding costs must be 0 or higher.";
        }
        if (
          typeof draft.existingHome.appreciationPct === "number" &&
          draft.existingHome.appreciationPct < 0
        ) {
          nextErrors.existingHome = "Appreciation must be 0 or higher.";
        }
      }
    }

    if (index === 2) {
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

    if (index === 3) {
      if (draft.annualBudgetItems.some((item) => item.annualAmount < 0)) {
        nextErrors.annualBudgetItems = "Annual budget amounts must be 0 or higher.";
      }
    }

    if (index === 4) {
      if (draft.investments.some((item) => item.marketValue < 0)) {
        nextErrors.investments = "Investment values must be 0 or higher.";
      }
      if (
        draft.investments.some(
          (item) =>
            typeof item.expectedAnnualReturnPct === "number" &&
            item.expectedAnnualReturnPct < 0
        )
      ) {
        nextErrors.investments = "Investment returns must be 0 or higher.";
      }
      if (
        draft.investments.some(
          (item) =>
            typeof item.monthlyContribution === "number" &&
            item.monthlyContribution < 0
        )
      ) {
        nextErrors.investments = "Contributions must be 0 or higher.";
      }
    }

    if (index === 5) {
      if (draft.insurances.some((item) => item.premiumAmount < 0)) {
        nextErrors.insurances = "Premiums must be 0 or higher.";
      }
      if (
        draft.insurances.some(
          (item) => typeof item.cashValueAsOf === "number" && item.cashValueAsOf < 0
        )
      ) {
        nextErrors.insurances = "Cash values must be 0 or higher.";
      }
      if (
        draft.insurances.some(
          (item) =>
            typeof item.cashValueAnnualGrowthPct === "number" &&
            item.cashValueAnnualGrowthPct < 0
        )
      ) {
        nextErrors.insurances = "Cash value growth must be 0 or higher.";
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
              <Text size="sm" c="dimmed">
                We’ll use this as your starting cash balance.
              </Text>
            </Stack>
          )}

          {step === 1 && (
            <Stack gap="md">
              <SegmentedControl
                value={draft.housingStatus}
                onChange={(value) =>
                  updateDraft("housingStatus", value as OnboardingDraft["housingStatus"])
                }
                data={[
                  { label: "Renting", value: "rent" },
                  { label: "Own existing home", value: "own_existing" },
                ]}
              />
              {draft.housingStatus === "rent" ? (
                <NumberInput
                  label="Monthly rent"
                  value={draft.rentMonthly}
                  error={errors.rentMonthly}
                  onChange={(value) => updateDraft("rentMonthly", Number(value ?? 0))}
                  thousandSeparator=","
                  min={0}
                />
              ) : (
                <Stack gap="sm">
                  <NumberInput
                    label="Current market value"
                    value={draft.existingHome.marketValue}
                    error={errors.existingHome}
                    onChange={(value) =>
                      updateDraft("existingHome", {
                        ...draft.existingHome,
                        marketValue: Number(value ?? 0),
                      })
                    }
                    thousandSeparator=","
                    min={0}
                  />
                  <Group grow>
                    <NumberInput
                      label="Mortgage balance"
                      value={draft.existingHome.mortgageBalance}
                      onChange={(value) =>
                        updateDraft("existingHome", {
                          ...draft.existingHome,
                          mortgageBalance: Number(value ?? 0),
                        })
                      }
                      thousandSeparator=","
                      min={0}
                    />
                    <NumberInput
                      label="Annual rate (%)"
                      value={draft.existingHome.annualRatePct}
                      onChange={(value) =>
                        updateDraft("existingHome", {
                          ...draft.existingHome,
                          annualRatePct: Number(value ?? 0),
                        })
                      }
                      min={0}
                    />
                  </Group>
                  <Group grow>
                    <NumberInput
                      label="Remaining term (months)"
                      value={draft.existingHome.remainingTermMonths}
                      onChange={(value) =>
                        updateDraft("existingHome", {
                          ...draft.existingHome,
                          remainingTermMonths: Number(value ?? 0),
                        })
                      }
                      min={1}
                    />
                    <NumberInput
                      label="Monthly holding cost (optional)"
                      value={draft.existingHome.holdingCostMonthly ?? 0}
                      onChange={(value) =>
                        updateDraft("existingHome", {
                          ...draft.existingHome,
                          holdingCostMonthly: Number(value ?? 0),
                        })
                      }
                      thousandSeparator=","
                      min={0}
                    />
                  </Group>
                  <NumberInput
                    label="Annual appreciation (%) (optional)"
                    value={draft.existingHome.appreciationPct ?? 0}
                    onChange={(value) =>
                      updateDraft("existingHome", {
                        ...draft.existingHome,
                        appreciationPct: Number(value ?? 0),
                      })
                    }
                    min={0}
                  />
                </Stack>
              )}
            </Stack>
          )}

          {step === 2 && (
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

          {step === 3 && (
            <Stack gap="md">
              <Stack gap="sm">
                {draft.annualBudgetItems.map((item, index) => (
                  <Group
                    key={`annual-budget-item-${index}`}
                    align="flex-end"
                    wrap="nowrap"
                  >
                    <TextInput
                      label={index === 0 ? "Annual budget item" : undefined}
                      placeholder="Travel, education, etc."
                      value={item.label}
                      onChange={(event) =>
                        updateAnnualBudgetItem(index, {
                          label: event.currentTarget.value,
                        })
                      }
                      style={{ flex: 2 }}
                    />
                    <NumberInput
                      label={index === 0 ? "Annual amount" : undefined}
                      value={item.annualAmount}
                      onChange={(value) =>
                        updateAnnualBudgetItem(index, {
                          annualAmount: Number(value ?? 0),
                        })
                      }
                      thousandSeparator=","
                      min={0}
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="subtle"
                      color="red"
                      onClick={() => removeAnnualBudgetItem(index)}
                    >
                      Remove
                    </Button>
                  </Group>
                ))}
                {errors.annualBudgetItems && (
                  <Text size="xs" c="red">
                    {errors.annualBudgetItems}
                  </Text>
                )}
                <Group justify="space-between">
                  <Button variant="light" onClick={addAnnualBudgetItem}>
                    Add annual budget item
                  </Button>
                  <Text size="sm" c="dimmed">
                    Total annual budget: {totalAnnualBudget.toLocaleString()} (
                    {(totalAnnualBudget / 12).toLocaleString()}/mo)
                  </Text>
                </Group>
              </Stack>
            </Stack>
          )}

          {step === 4 && (
            <Stack gap="md">
              <Stack gap="sm">
                {draft.investments.map((item, index) => (
                  <Stack key={`investment-${index}`} gap="xs">
                    <Group align="flex-end" wrap="nowrap">
                      <Select
                        label={index === 0 ? "Asset class" : undefined}
                        data={[
                          { value: "equity", label: "Equity" },
                          { value: "bond", label: "Bond" },
                          { value: "fund", label: "Fund" },
                          { value: "crypto", label: "Crypto" },
                        ]}
                        value={item.assetClass}
                        onChange={(value) =>
                          updateInvestment(index, {
                            assetClass:
                              (value as OnboardingDraft["investments"][number]["assetClass"]) ??
                              "equity",
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <NumberInput
                        label={index === 0 ? "Market value" : undefined}
                        value={item.marketValue}
                        onChange={(value) =>
                          updateInvestment(index, {
                            marketValue: Number(value ?? 0),
                          })
                        }
                        thousandSeparator=","
                        min={0}
                        style={{ flex: 1 }}
                      />
                      <NumberInput
                        label={index === 0 ? "Expected return (%)" : undefined}
                        value={item.expectedAnnualReturnPct ?? undefined}
                        onChange={(value) =>
                          updateInvestment(index, {
                            expectedAnnualReturnPct:
                              value === "" || value === null ? undefined : Number(value ?? 0),
                          })
                        }
                        min={0}
                        style={{ flex: 1 }}
                      />
                      <NumberInput
                        label={index === 0 ? "Monthly contribution" : undefined}
                        value={item.monthlyContribution ?? undefined}
                        onChange={(value) =>
                          updateInvestment(index, {
                            monthlyContribution:
                              value === "" || value === null ? undefined : Number(value ?? 0),
                          })
                        }
                        thousandSeparator=","
                        min={0}
                        style={{ flex: 1 }}
                      />
                      <Button
                        variant="subtle"
                        color="red"
                        onClick={() => removeInvestment(index)}
                      >
                        Remove
                      </Button>
                    </Group>
                  </Stack>
                ))}
                {errors.investments && (
                  <Text size="xs" c="red">
                    {errors.investments}
                  </Text>
                )}
                <Button variant="light" onClick={addInvestment}>
                  Add investment
                </Button>
              </Stack>
            </Stack>
          )}

          {step === 5 && (
            <Stack gap="md">
              <Stack gap="sm">
                {draft.insurances.map((item, index) => (
                  <Stack key={`insurance-${index}`} gap="xs">
                    <Group align="flex-end" wrap="nowrap">
                      <Select
                        label={index === 0 ? "Insurance type" : undefined}
                        data={[
                          { value: "life", label: "Life" },
                          { value: "savings", label: "Savings" },
                          { value: "accident", label: "Accident" },
                          { value: "medical", label: "Medical" },
                        ]}
                        value={item.insuranceType}
                        onChange={(value) =>
                          updateInsurance(index, {
                            insuranceType:
                              (value as OnboardingDraft["insurances"][number]["insuranceType"]) ??
                              "life",
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <SegmentedControl
                        value={item.premiumMode}
                        onChange={(value) =>
                          updateInsurance(index, {
                            premiumMode:
                              value as OnboardingDraft["insurances"][number]["premiumMode"],
                          })
                        }
                        data={[
                          { value: "monthly", label: "Monthly" },
                          { value: "annual", label: "Annual" },
                        ]}
                      />
                      <NumberInput
                        label={index === 0 ? "Premium amount" : undefined}
                        value={item.premiumAmount}
                        onChange={(value) =>
                          updateInsurance(index, {
                            premiumAmount: Number(value ?? 0),
                          })
                        }
                        thousandSeparator=","
                        min={0}
                        style={{ flex: 1 }}
                      />
                      <Button
                        variant="subtle"
                        color="red"
                        onClick={() => removeInsurance(index)}
                      >
                        Remove
                      </Button>
                    </Group>
                    <Group align="flex-end" wrap="nowrap">
                      <Switch
                        label="Has cash value"
                        checked={item.hasCashValue ?? false}
                        onChange={(event) =>
                          updateInsurance(index, {
                            hasCashValue: event.currentTarget.checked,
                          })
                        }
                      />
                      {item.hasCashValue && (
                        <>
                          <NumberInput
                            label="Cash value as of today"
                            value={item.cashValueAsOf ?? 0}
                            onChange={(value) =>
                              updateInsurance(index, {
                                cashValueAsOf:
                                  value === "" || value === null ? undefined : Number(value ?? 0),
                              })
                            }
                            thousandSeparator=","
                            min={0}
                            style={{ flex: 1 }}
                          />
                          <NumberInput
                            label="Cash value growth (%)"
                            value={item.cashValueAnnualGrowthPct ?? 0}
                            onChange={(value) =>
                              updateInsurance(index, {
                                cashValueAnnualGrowthPct:
                                  value === "" || value === null ? undefined : Number(value ?? 0),
                              })
                            }
                            min={0}
                            style={{ flex: 1 }}
                          />
                        </>
                      )}
                      <TextInput
                        label="Coverage notes (optional)"
                        value={(item.coverageMeta?.notes as string) ?? ""}
                        onChange={(event) =>
                          updateInsurance(index, {
                            coverageMeta: {
                              ...(item.coverageMeta ?? {}),
                              notes: event.currentTarget.value,
                            },
                          })
                        }
                        style={{ flex: 1 }}
                      />
                    </Group>
                  </Stack>
                ))}
                {errors.insurances && (
                  <Text size="xs" c="red">
                    {errors.insurances}
                  </Text>
                )}
                <Button variant="light" onClick={addInsurance}>
                  Add insurance policy
                </Button>
              </Stack>
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
