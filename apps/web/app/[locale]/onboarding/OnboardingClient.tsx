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
import { useLocale, useTranslations } from "next-intl";
import { applyOnboardingToScenario } from "../../../src/engine/onboardingTransforms";
import type { OnboardingDraft } from "../../../src/onboarding/types";
import {
  createMemberId,
  getActiveScenario,
  useScenarioStore,
} from "../../../src/store/scenarioStore";

type DraftErrors = Partial<Record<keyof OnboardingDraft, string>>;

export default function OnboardingClient() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("onboarding");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const steps = [
    t("steps.basics"),
    t("steps.housing"),
    t("steps.incomeExpenses"),
    t("steps.annualBudgets"),
    t("steps.investments"),
    t("steps.insurance"),
  ];
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const replaceScenario = useScenarioStore((state) => state.replaceScenario);

  const activeScenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({
    initialCash: 0,
    members: [
      {
        id: createMemberId(),
        name: t("defaultMemberName"),
        kind: "person",
      },
    ],
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
    annualBudgetItems: [{ label: t("defaultAnnualBudgetItem"), annualAmount: 0 }],
    investments: [],
    insurances: [],
  }));
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

  const updateMember = (
    index: number,
    patch: Partial<OnboardingDraft["members"][number]>
  ) => {
    setDraft((current) => {
      const next = [...current.members];
      next[index] = { ...next[index], ...patch };
      return { ...current, members: next };
    });
  };

  const addMember = () => {
    setDraft((current) => ({
      ...current,
      members: [
        ...current.members,
        { id: createMemberId(), name: "", kind: "person" },
      ],
    }));
  };

  const removeMember = (index: number) => {
    setDraft((current) => ({
      ...current,
      members: current.members.filter((_, memberIndex) => memberIndex !== index),
    }));
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
        nextErrors.initialCash = validation("initialCashMin");
      }
    }

    if (index === 1) {
      if (draft.housingStatus === "rent") {
        if (draft.rentMonthly <= 0) {
          nextErrors.rentMonthly = validation("rentMonthlyRequired");
        }
      } else {
        if (draft.existingHome.marketValue <= 0) {
          nextErrors.existingHome = validation("existingHomeMarketValue");
        }
        if (draft.existingHome.mortgageBalance < 0) {
          nextErrors.existingHome = validation("mortgageBalanceNonNegative");
        }
        if (draft.existingHome.annualRatePct < 0) {
          nextErrors.existingHome = validation("mortgageRateMin");
        }
        if (draft.existingHome.remainingTermMonths < 1) {
          nextErrors.existingHome = validation("remainingTermMin");
        }
        if (
          typeof draft.existingHome.holdingCostMonthly === "number" &&
          draft.existingHome.holdingCostMonthly < 0
        ) {
          nextErrors.existingHome = validation("holdingCostMonthlyMin");
        }
        if (
          typeof draft.existingHome.appreciationPct === "number" &&
          (draft.existingHome.appreciationPct < -100 ||
            draft.existingHome.appreciationPct > 100)
        ) {
          nextErrors.existingHome = validation("annualAppreciationMin");
        }
      }
    }

    if (index === 2) {
      if (draft.salaryMonthly <= 0) {
        nextErrors.salaryMonthly = validation("salaryMonthlyRequired");
      }
      if (draft.expenseItems.length === 0) {
        nextErrors.expenseItems = validation("expenseItemsRequired");
      }
      if (draft.expenseItems.some((item) => item.monthlyAmount < 0)) {
        nextErrors.expenseItems = validation("expenseItemsNonNegative");
      }
    }

    if (index === 3) {
      if (draft.annualBudgetItems.some((item) => item.annualAmount < 0)) {
        nextErrors.annualBudgetItems = validation("annualBudgetNonNegative");
      }
    }

    if (index === 4) {
      if (draft.investments.some((item) => item.marketValue < 0)) {
        nextErrors.investments = validation("investmentValuesNonNegative");
      }
      if (
        draft.investments.some(
          (item) =>
            typeof item.expectedAnnualReturnPct === "number" &&
            item.expectedAnnualReturnPct < 0
        )
      ) {
        nextErrors.investments = validation("investmentReturnsNonNegative");
      }
      if (
        draft.investments.some(
          (item) =>
            typeof item.monthlyContribution === "number" &&
            item.monthlyContribution < 0
        )
      ) {
        nextErrors.investments = validation("investmentContributionsNonNegative");
      }
    }

    if (index === 5) {
      if (draft.insurances.some((item) => item.premiumAmount < 0)) {
        nextErrors.insurances = validation("premiumsNonNegative");
      }
      if (
        draft.insurances.some(
          (item) => typeof item.cashValueAsOf === "number" && item.cashValueAsOf < 0
        )
      ) {
        nextErrors.insurances = validation("cashValueNonNegative");
      }
      if (
        draft.insurances.some(
          (item) =>
            typeof item.cashValueAnnualGrowthPct === "number" &&
            item.cashValueAnnualGrowthPct < 0
        )
      ) {
        nextErrors.insurances = validation("cashValueGrowthNonNegative");
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
    router.push(`/${locale}/overview`);
  };

  if (!activeScenario) {
    return null;
  }

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2}>{t("title")}</Title>
        <Text size="sm" c="dimmed">
          {t("subtitle")}
        </Text>
      </Stack>

      <Card withBorder radius="md" padding="lg">
        <Stack gap="lg">
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {t("stepLabel", { step: step + 1, total: steps.length })}
            </Text>
            <Title order={4}>{steps[step]}</Title>
          </Stack>

          {step === 0 && (
            <Stack gap="md">
              <NumberInput
                label={t("initialCash")}
                value={draft.initialCash}
                error={errors.initialCash}
                onChange={(value) => updateDraft("initialCash", Number(value ?? 0))}
                thousandSeparator=","
                min={0}
              />
              <Text size="sm" c="dimmed">
                {t("initialCashHint")}
              </Text>
              <Stack gap="sm">
                <Text fw={600}>{t("membersTitle")}</Text>
                {draft.members.map((member, index) => (
                  <Group key={member.id} align="flex-end" wrap="nowrap">
                    <TextInput
                      label={index === 0 ? t("memberNameLabel") : undefined}
                      placeholder={t("memberNamePlaceholder")}
                      value={member.name}
                      onChange={(event) =>
                        updateMember(index, { name: event.currentTarget.value })
                      }
                      style={{ flex: 2 }}
                    />
                    <Select
                      label={index === 0 ? t("memberKindLabel") : undefined}
                      value={member.kind}
                      onChange={(value) =>
                        updateMember(index, {
                          kind: (value ?? "person") as OnboardingDraft["members"][number]["kind"],
                        })
                      }
                      data={[
                        { value: "person", label: t("memberKindPerson") },
                        { value: "pet", label: t("memberKindPet") },
                      ]}
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="subtle"
                      color="red"
                      onClick={() => removeMember(index)}
                    >
                      {t("removeMember")}
                    </Button>
                  </Group>
                ))}
                <Button variant="light" onClick={addMember}>
                  {t("addMember")}
                </Button>
              </Stack>
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
                  { label: t("housingRenting"), value: "rent" },
                  { label: t("housingOwnExisting"), value: "own_existing" },
                ]}
              />
              {draft.housingStatus === "rent" ? (
                <NumberInput
                  label={t("monthlyRent")}
                  value={draft.rentMonthly}
                  error={errors.rentMonthly}
                  onChange={(value) => updateDraft("rentMonthly", Number(value ?? 0))}
                  thousandSeparator=","
                  min={0}
                />
              ) : (
                <Stack gap="sm">
                  <NumberInput
                    label={t("currentMarketValue")}
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
                      label={t("mortgageBalance")}
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
                      label={t("annualRate")}
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
                      label={t("remainingTerm")}
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
                      label={t("holdingCostMonthlyOptional")}
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
                    label={t("annualAppreciationOptional")}
                    value={draft.existingHome.appreciationPct ?? 0}
                    onChange={(value) =>
                      updateDraft("existingHome", {
                        ...draft.existingHome,
                        appreciationPct: Number(value ?? 0),
                      })
                    }
                    min={-100}
                    max={100}
                  />
                </Stack>
              )}
            </Stack>
          )}

          {step === 2 && (
            <Stack gap="md">
              <NumberInput
                label={t("monthlySalary")}
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
                      label={index === 0 ? t("expenseItemLabel") : undefined}
                      placeholder={t("expenseItemPlaceholder")}
                      value={item.label}
                      onChange={(event) =>
                        updateExpenseItem(index, { label: event.currentTarget.value })
                      }
                      style={{ flex: 2 }}
                    />
                    <NumberInput
                      label={index === 0 ? t("expenseMonthlyAmount") : undefined}
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
                      {common("actionRemove")}
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
                    {t("addExpenseItem")}
                  </Button>
                  <Text size="sm" c="dimmed">
                    {t("totalMonthlyExpenses", {
                      value: totalMonthlyExpenses.toLocaleString(locale),
                    })}
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
                      label={index === 0 ? t("annualBudgetLabel") : undefined}
                      placeholder={t("annualBudgetPlaceholder")}
                      value={item.label}
                      onChange={(event) =>
                        updateAnnualBudgetItem(index, {
                          label: event.currentTarget.value,
                        })
                      }
                      style={{ flex: 2 }}
                    />
                    <NumberInput
                      label={index === 0 ? t("annualAmount") : undefined}
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
                      {common("actionRemove")}
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
                    {t("addAnnualBudgetItem")}
                  </Button>
                  <Text size="sm" c="dimmed">
                    {t("totalAnnualBudget", {
                      annual: totalAnnualBudget.toLocaleString(locale),
                      monthly: (totalAnnualBudget / 12).toLocaleString(locale),
                    })}
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
                        label={index === 0 ? t("assetClass") : undefined}
                        data={[
                          { value: "equity", label: t("assetClassEquity") },
                          { value: "bond", label: t("assetClassBond") },
                          { value: "fund", label: t("assetClassFund") },
                          { value: "crypto", label: t("assetClassCrypto") },
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
                        label={index === 0 ? t("marketValue") : undefined}
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
                        label={index === 0 ? t("expectedReturn") : undefined}
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
                        label={index === 0 ? t("monthlyContribution") : undefined}
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
                        {common("actionRemove")}
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
                  {t("addInvestment")}
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
                        label={index === 0 ? t("insuranceType") : undefined}
                        data={[
                          { value: "life", label: t("insuranceLife") },
                          { value: "savings", label: t("insuranceSavings") },
                          { value: "accident", label: t("insuranceAccident") },
                          { value: "medical", label: t("insuranceMedical") },
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
                          { value: "monthly", label: t("premiumMonthly") },
                          { value: "annual", label: t("premiumAnnual") },
                        ]}
                      />
                      <NumberInput
                        label={index === 0 ? t("premiumAmount") : undefined}
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
                        {common("actionRemove")}
                      </Button>
                    </Group>
                    <Group align="flex-end" wrap="nowrap">
                      <Switch
                        label={t("hasCashValue")}
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
                            label={t("cashValueAsOf")}
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
                            label={t("cashValueGrowth")}
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
                        label={t("coverageNotes")}
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
                  {t("addInsurance")}
                </Button>
              </Stack>
            </Stack>
          )}

          <Group justify="space-between">
            <Button variant="subtle" onClick={handleBack} disabled={step === 0}>
              {common("actionBack")}
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={handleNext}>{common("actionContinue")}</Button>
            ) : (
              <Button onClick={handleSubmit}>{t("finishSetup")}</Button>
            )}
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
