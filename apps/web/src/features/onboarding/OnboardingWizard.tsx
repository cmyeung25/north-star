"use client";

import { Button, Group, Stack, Stepper, Text, Title } from "@mantine/core";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  applyOnboardingDraftToScenario,
  buildDefaultOnboardingDraft,
  type OnboardingBudgetRuleDraft,
  type OnboardingDraft,
  type OnboardingIncomeDraft,
  type OnboardingMemberDraft,
  type OnboardingTimelineEventDraft,
} from "../../domain/onboarding/applyDraft";
import { compileBudgetRuleToMonthlySeries, sumByMonth } from "../../domain/budget/compileBudgetRules";
import {
  getActiveScenario,
  useScenarioStore,
  type BudgetRule,
  type OnboardingPersona,
  type ScenarioMember,
} from "../../store/scenarioStore";
import { normalizeOnboardingMonth } from "../../utils/month";
import { getBaseMonth } from "./utils";
import { detectOnboardingOverlaps } from "../../domain/onboarding/overlapDetector";
import { hasIncomeAttribution } from "../../domain/onboarding/validation";
import {
  applyPersonaPreset,
  mergePersonaDraft,
  personaPresets,
} from "../../domain/onboarding/personas";
import StepHouseholdMembers from "./steps/StepHouseholdMembers";
import StepGlobalSettings from "./steps/StepGlobalSettings";
import StepBudgetRules from "./steps/StepBudgetRules";
import StepPositions from "./steps/StepPositions";
import StepIncomeSources from "./steps/StepIncomeSources";
import StepTimelineEvents from "./steps/StepTimelineEvents";
import StepReviewConfirm from "./steps/StepReviewConfirm";
import StepPersonaPreset from "./steps/StepPersonaPreset";
import { buildScenarioUrl } from "../../utils/scenarioContext";

const steps = [
  "persona",
  "members",
  "settings",
  "budget",
  "positions",
  "income",
  "timeline",
  "review",
] as const;

type StepKey = (typeof steps)[number];

const templates = [
  { label: "爸爸", kind: "person", name: "爸爸" },
  { label: "媽媽", kind: "person", name: "媽媽" },
  { label: "小朋友", kind: "person", name: "小朋友" },
  { label: "寵物", kind: "pet", name: "寵物" },
] as const;

const categoryAgeRequired = new Set(["childcare", "education", "eldercare", "petcare"]);

const createMemberDraft = (template?: { name: string; kind: "person" | "pet" }) => ({
  id: nanoid(),
  name: template?.name ?? "",
  kind: template?.kind ?? "person",
  birthMonth: "",
  ageAtBaseMonth: undefined,
});

const createBudgetRuleDraft = (baseMonth: string): OnboardingBudgetRuleDraft => ({
  id: nanoid(),
  name: "",
  enabled: true,
  memberId: "household",
  category: "baseline",
  ageBand: { fromYears: 0, toYears: 99 },
  monthlyAmount: 0,
  annualGrowthPct: 0,
  startMonth: baseMonth,
  endMonth: "",
});

const createIncomeDraft = (
  baseMonth: string,
  memberId: string | null
): OnboardingIncomeDraft => ({
  id: nanoid(),
  title: "",
  memberId,
  subtype: "salary",
  monthlyAmount: 0,
  startMonth: baseMonth,
  endMonth: "",
  endAtAgeYears: undefined,
});

const createTimelineEventDraft = (baseMonth: string): OnboardingTimelineEventDraft => ({
  id: nanoid(),
  title: "",
  type: "custom",
  memberId: null,
  startMonth: baseMonth,
  endMonth: "",
  monthlyAmount: 0,
  oneTimeAmount: 0,
});

export default function OnboardingWizard() {
  const router = useRouter();
  const locale = useLocale();
  const onboardingText = useTranslations("onboarding");

  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const membersStore = useScenarioStore((state) => state.members);
  const budgetRulesStore = useScenarioStore((state) => state.budgetRules);
  const appSettings = useScenarioStore((state) => state.appSettings);
  const updateScenarioAssumptions = useScenarioStore(
    (state) => state.updateScenarioAssumptions
  );
  const setGlobalHorizonMonths = useScenarioStore(
    (state) => state.setGlobalHorizonMonths
  );
  const setGlobalBaseMonth = useScenarioStore((state) => state.setGlobalBaseMonth);
  const setAnnualInflationPct = useScenarioStore(
    (state) => state.setAnnualInflationPct
  );
  const setViewMode = useScenarioStore((state) => state.setViewMode);
  const updateScenarioClientComputed = useScenarioStore(
    (state) => state.updateScenarioClientComputed
  );
  const updateScenarioMeta = useScenarioStore((state) => state.updateScenarioMeta);
  const upsertEventDefinition = useScenarioStore((state) => state.upsertEventDefinition);
  const upsertScenarioEventRef = useScenarioStore(
    (state) => state.upsertScenarioEventRef
  );
  const removeScenarioEventRef = useScenarioStore((state) => state.removeScenarioEventRef);
  const removeEventDefinition = useScenarioStore((state) => state.removeEventDefinition);
  const addCarPosition = useScenarioStore((state) => state.addCarPosition);
  const updateCarPosition = useScenarioStore((state) => state.updateCarPosition);
  const addHomePosition = useScenarioStore((state) => state.addHomePosition);
  const updateHomePosition = useScenarioStore((state) => state.updateHomePosition);
  const addInvestmentPosition = useScenarioStore((state) => state.addInvestmentPosition);
  const updateInvestmentPosition = useScenarioStore(
    (state) => state.updateInvestmentPosition
  );
  const addLoanPosition = useScenarioStore((state) => state.addLoanPosition);
  const updateLoanPosition = useScenarioStore((state) => state.updateLoanPosition);
  const createMember = useScenarioStore((state) => state.createMember);
  const updateMember = useScenarioStore((state) => state.updateMember);
  const deleteMember = useScenarioStore((state) => state.deleteMember);
  const createBudgetRule = useScenarioStore((state) => state.createBudgetRule);
  const updateBudgetRuleAction = useScenarioStore((state) => state.updateBudgetRule);
  const removeBudgetRule = useScenarioStore((state) => state.removeBudgetRule);

  const scenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [housingCostsIncluded, setHousingCostsIncluded] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<OnboardingPersona | null>(
    null
  );
  const draftScenarioIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!scenario) {
      return;
    }
    if (draftScenarioIdRef.current !== scenario.id) {
      const baseMonth = getBaseMonth(scenario);
      const nextDraft = buildDefaultOnboardingDraft(scenario, baseMonth);
      nextDraft.settings.baseMonth = appSettings.globalBaseMonth ?? baseMonth;
      nextDraft.settings.horizonMonths = appSettings.globalHorizonMonths;
      nextDraft.settings.annualInflationPct = appSettings.annualInflationPct;
      nextDraft.settings.viewMode = appSettings.viewMode;
      setDraft(nextDraft);
      setSelectedPersona(scenario.clientComputed?.onboardingPersona ?? null);
      draftScenarioIdRef.current = scenario.id;
    }
  }, [appSettings, scenario]);

  const stepKey: StepKey = steps[step] ?? "members";

  const previewBudgetSeries = useMemo(() => {
    if (!draft || !scenario) {
      return [];
    }
    const draftMembers: ScenarioMember[] = draft.members.map((member) => ({
      id: member.id,
      name: member.name,
      kind: member.kind,
      birthMonth: member.birthMonth || undefined,
      ageAtBaseMonth: member.ageAtBaseMonth,
      applyScope: { scope: "all" },
    }));

    const draftRules: BudgetRule[] = draft.budgetRules.map((rule) => ({
      id: rule.id,
      name: rule.name || "",
      enabled: rule.enabled,
      memberId: rule.memberId === "household" ? undefined : rule.memberId ?? undefined,
      category: rule.category,
      ageBand: rule.ageBand ?? { fromYears: 0, toYears: 120 },
      monthlyAmount: rule.monthlyAmount,
      annualGrowthPct: rule.annualGrowthPct ?? 0,
      startMonth: rule.startMonth ?? undefined,
      endMonth: rule.endMonth ?? undefined,
      applyScope: { scope: "all" },
    }));

    const scenarioForBudget = {
      ...scenario,
      assumptions: {
        ...scenario.assumptions,
        baseMonth: draft.settings.baseMonth,
        horizonMonths: draft.settings.horizonMonths,
      },
    };

    const ledger = draftRules.flatMap((rule) =>
      compileBudgetRuleToMonthlySeries(rule, scenarioForBudget, draftMembers)
    );
    return sumByMonth(ledger).map((entry) => ({
      month: entry.month,
      value: Math.abs(entry.totalAmountSigned),
    }));
  }, [draft, scenario]);

  const overlapWarnings = useMemo(() => {
    if (!draft) {
      return [];
    }
    const hasHomePosition = draft.positions.homes.length > 0;
    const rules: BudgetRule[] = draft.budgetRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      memberId: rule.memberId === "household" ? undefined : rule.memberId ?? undefined,
      category: rule.category,
      ageBand: rule.ageBand ?? { fromYears: 0, toYears: 120 },
      monthlyAmount: rule.monthlyAmount,
      annualGrowthPct: rule.annualGrowthPct ?? 0,
      applyScope: { scope: "all" },
    }));
    return detectOnboardingOverlaps(rules, draft.timelineEvents, hasHomePosition);
  }, [draft]);

  if (!scenario || !draft) {
    return null;
  }

  const handleMemberUpdate = (id: string, patch: Partial<OnboardingMemberDraft>) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        members: current.members.map((member) =>
          member.id === id ? { ...member, ...patch } : member
        ),
      };
    });
  };

  const handleBudgetRuleUpdate = (
    id: string,
    patch: Partial<OnboardingBudgetRuleDraft>
  ) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        budgetRules: current.budgetRules.map((rule) =>
          rule.id === id ? { ...rule, ...patch } : rule
        ),
      };
    });
  };

  const handleIncomeUpdate = (id: string, patch: Partial<OnboardingIncomeDraft>) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        incomes: current.incomes.map((income) =>
          income.id === id ? { ...income, ...patch } : income
        ),
      };
    });
  };

  const handleEventUpdate = (
    id: string,
    patch: Partial<OnboardingTimelineEventDraft>
  ) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        timelineEvents: current.timelineEvents.map((event) =>
          event.id === id ? { ...event, ...patch } : event
        ),
      };
    });
  };

  const validateStep = (nextStepKey: StepKey) => {
    const nextErrors: Record<string, string> = {};

    if (nextStepKey === "members") {
      if (draft.members.length === 0) {
        nextErrors.members = onboardingText("memberRequired");
      }
      draft.members.forEach((member) => {
        if (!member.name.trim()) {
          nextErrors[`member.${member.id}.name`] = onboardingText("memberNameRequired");
        }
        if (member.kind === "person") {
          const hasBirthMonth = member.birthMonth?.trim() !== "";
          const hasAge = typeof member.ageAtBaseMonth === "number";
          if (!hasBirthMonth && !hasAge) {
            nextErrors[`member.${member.id}.birthMonth`] = onboardingText(
              "memberBirthOrAgeRequired"
            );
          }
        }
        if (member.birthMonth) {
          const normalized = normalizeOnboardingMonth(member.birthMonth);
          if (!normalized.ok) {
            nextErrors[`member.${member.id}.birthMonth`] = onboardingText("monthInvalid");
          }
        }
      });
    }

    if (nextStepKey === "settings") {
      const baseMonthNormalized = normalizeOnboardingMonth(draft.settings.baseMonth);
      if (!baseMonthNormalized.ok || !baseMonthNormalized.month) {
        nextErrors.baseMonth = onboardingText("monthInvalid");
      }
      if (draft.settings.horizonMonths <= 0) {
        nextErrors.horizonMonths = onboardingText("horizonRequired");
      }
    }

    if (nextStepKey === "budget") {
      draft.budgetRules.forEach((rule) => {
        if (!rule.name.trim()) {
          nextErrors[`rule.${rule.id}.name`] = onboardingText("ruleNameRequired");
        }
        if (!rule.memberId) {
          nextErrors[`rule.${rule.id}.memberId`] = onboardingText("memberRequired");
        }
        if (rule.monthlyAmount <= 0) {
          nextErrors[`rule.${rule.id}.monthlyAmount`] = onboardingText("amountRequired");
        }
        if (categoryAgeRequired.has(rule.category)) {
          const ageBand = rule.ageBand;
          if (!ageBand || ageBand.fromYears < 0 || ageBand.toYears <= ageBand.fromYears) {
            nextErrors[`rule.${rule.id}.ageFrom`] = onboardingText("ageBandRequired");
          }
        }
        if (rule.startMonth) {
          const normalized = normalizeOnboardingMonth(rule.startMonth, draft.settings.baseMonth);
          if (!normalized.ok) {
            nextErrors[`rule.${rule.id}.startMonth`] = onboardingText("monthInvalid");
          }
        }
        if (rule.endMonth) {
          const normalized = normalizeOnboardingMonth(rule.endMonth);
          if (!normalized.ok) {
            nextErrors[`rule.${rule.id}.endMonth`] = onboardingText("monthInvalid");
          }
        }
      });
    }

    if (nextStepKey === "positions") {
      draft.positions.homes.forEach((home) => {
        if (home.purchaseMonth) {
          const normalized = normalizeOnboardingMonth(home.purchaseMonth, draft.settings.baseMonth);
          if (!normalized.ok) {
            nextErrors[`home.${home.id}.purchaseMonth`] = onboardingText("monthInvalid");
          }
        }
        if ((home.purchasePrice ?? 0) < 0) {
          nextErrors[`home.${home.id}.purchasePrice`] = onboardingText("amountInvalid");
        }
      });
      draft.positions.cars.forEach((car) => {
        if (car.purchaseMonth) {
          const normalized = normalizeOnboardingMonth(car.purchaseMonth, draft.settings.baseMonth);
          if (!normalized.ok) {
            nextErrors[`car.${car.id}.purchaseMonth`] = onboardingText("monthInvalid");
          }
        }
      });
      draft.positions.investments.forEach((investment) => {
        if (investment.startMonth) {
          const normalized = normalizeOnboardingMonth(
            investment.startMonth,
            draft.settings.baseMonth
          );
          if (!normalized.ok) {
            nextErrors[`investment.${investment.id}.startMonth`] = onboardingText("monthInvalid");
          }
        }
      });
      draft.positions.loans.forEach((loan) => {
        if (loan.startMonth) {
          const normalized = normalizeOnboardingMonth(loan.startMonth, draft.settings.baseMonth);
          if (!normalized.ok) {
            nextErrors[`loan.${loan.id}.startMonth`] = onboardingText("monthInvalid");
          }
        }
        if (loan.principal < 0) {
          nextErrors[`loan.${loan.id}.principal`] = onboardingText("amountInvalid");
        }
      });
    }

    if (nextStepKey === "income") {
      draft.incomes.forEach((income) => {
        if (!income.title.trim()) {
          nextErrors[`income.${income.id}.title`] = onboardingText("incomeNameRequired");
        }
        if (!hasIncomeAttribution(income)) {
          nextErrors[`income.${income.id}.memberId`] = onboardingText("memberRequired");
        }
        if (income.monthlyAmount <= 0) {
          nextErrors[`income.${income.id}.monthlyAmount`] = onboardingText("amountRequired");
        }
        if (income.startMonth) {
          const normalized = normalizeOnboardingMonth(
            income.startMonth,
            draft.settings.baseMonth
          );
          if (!normalized.ok) {
            nextErrors[`income.${income.id}.startMonth`] = onboardingText("monthInvalid");
          }
        }
        if (income.endMonth) {
          const normalized = normalizeOnboardingMonth(income.endMonth);
          if (!normalized.ok) {
            nextErrors[`income.${income.id}.endMonth`] = onboardingText("monthInvalid");
          }
        }
      });
    }

    if (nextStepKey === "timeline") {
      draft.timelineEvents.forEach((event) => {
        if (!event.title.trim()) {
          nextErrors[`event.${event.id}.title`] = onboardingText("eventNameRequired");
        }
        if (!event.memberId) {
          nextErrors[`event.${event.id}.memberId`] = onboardingText("memberRequired");
        }
        if ((event.monthlyAmount ?? 0) <= 0 && (event.oneTimeAmount ?? 0) <= 0) {
          nextErrors[`event.${event.id}.monthlyAmount`] = onboardingText("amountRequired");
        }
        if (event.startMonth) {
          const normalized = normalizeOnboardingMonth(
            event.startMonth,
            draft.settings.baseMonth
          );
          if (!normalized.ok) {
            nextErrors[`event.${event.id}.startMonth`] = onboardingText("monthInvalid");
          }
        }
        if (event.endMonth) {
          const normalized = normalizeOnboardingMonth(event.endMonth);
          if (!normalized.ok) {
            nextErrors[`event.${event.id}.endMonth`] = onboardingText("monthInvalid");
          }
        }
      });
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSelectPersona = (personaId: OnboardingPersona) => {
    const baseMonth = draft.settings.baseMonth;
    const personaDraft = applyPersonaPreset(personaId, baseMonth);
    setDraft((current) => (current ? mergePersonaDraft(current, personaDraft) : current));
    setSelectedPersona(personaId);
    updateScenarioClientComputed(scenario.id, { onboardingPersona: personaId });
  };

  const handleSkipPersona = () => {
    setSelectedPersona(null);
    updateScenarioClientComputed(scenario.id, { onboardingPersona: undefined });
  };

  const handleNext = () => {
    const currentKey = steps[step];
    if (!validateStep(currentKey)) {
      return;
    }
    setErrors({});
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFinish = () => {
    if (!validateStep("review")) {
      return;
    }

    applyOnboardingDraftToScenario(scenario, draft, {
      members: membersStore,
      budgetRules: budgetRulesStore,
      updateScenarioAssumptions,
      setGlobalHorizonMonths,
      setGlobalBaseMonth,
      setAnnualInflationPct,
      setViewMode,
      updateScenarioClientComputed,
      upsertEventDefinition,
      upsertScenarioEventRef,
      removeScenarioEventRef,
      removeEventDefinition,
      addCarPosition,
      updateCarPosition,
      addHomePosition,
      updateHomePosition,
      addInvestmentPosition,
      updateInvestmentPosition,
      addLoanPosition,
      updateLoanPosition,
      createMember,
      updateMember,
      deleteMember,
      createBudgetRule,
      updateBudgetRule: updateBudgetRuleAction,
      removeBudgetRule,
    });

    updateScenarioMeta(scenario.id, { onboardingVersion: 2 });
    updateScenarioClientComputed(scenario.id, { onboardingCompleted: true });
    router.push(`/${locale}${buildScenarioUrl("/dashboard", scenario.id)}`);
  };

  const totalMonthlyIncome = draft.incomes.reduce(
    (sum, income) => sum + (income.monthlyAmount ?? 0),
    0
  );
  const totalMonthlyBudget = draft.budgetRules.reduce(
    (sum, rule) => sum + (rule.monthlyAmount ?? 0),
    0
  );

  const assetsSummary = [
    onboardingText("reviewHomes", { count: draft.positions.homes.length }),
    onboardingText("reviewCars", { count: draft.positions.cars.length }),
    onboardingText("reviewInvestments", { count: draft.positions.investments.length }),
    onboardingText("reviewLoans", { count: draft.positions.loans.length }),
  ];

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Title order={2}>{onboardingText("title")}</Title>
          <Text size="sm" c="dimmed">
            {onboardingText("subtitle")}
          </Text>
        </Stack>
      </Group>

      <Stepper active={step} onStepClick={setStep} allowNextStepsSelect={false}>
        {steps.map((key) => (
          <Stepper.Step key={key} label={onboardingText(`step.${key}`)} />
        ))}
      </Stepper>

      {stepKey === "persona" && (
        <StepPersonaPreset
          presets={personaPresets}
          selectedId={selectedPersona}
          onSelect={handleSelectPersona}
          onSkip={handleSkipPersona}
          t={onboardingText}
        />
      )}

      {stepKey === "members" && (
        <StepHouseholdMembers
          members={draft.members}
          templates={templates.map((template) => ({
            label: template.label,
            kind: template.kind,
            name: template.name,
          }))}
          errors={errors}
          onAddMember={() =>
            setDraft((current) =>
              current
                ? { ...current, members: [...current.members, createMemberDraft()] }
                : current
            )
          }
          onAddTemplate={(template) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    members: [
                      ...current.members,
                      createMemberDraft({ name: template.name, kind: template.kind }),
                    ],
                  }
                : current
            )
          }
          onUpdateMember={handleMemberUpdate}
          onRemoveMember={(id) =>
            setDraft((current) =>
              current
                ? { ...current, members: current.members.filter((member) => member.id !== id) }
                : current
            )
          }
          t={onboardingText}
        />
      )}

      {stepKey === "settings" && (
        <StepGlobalSettings
          settings={draft.settings}
          errors={errors}
          onChange={(patch) =>
            setDraft((current) =>
              current ? { ...current, settings: { ...current.settings, ...patch } } : current
            )
          }
          t={onboardingText}
        />
      )}

      {stepKey === "budget" && (
        <StepBudgetRules
          rules={draft.budgetRules}
          members={draft.members}
          previewSeries={previewBudgetSeries}
          errors={errors}
          onAddRule={() =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    budgetRules: [
                      ...current.budgetRules,
                      createBudgetRuleDraft(current.settings.baseMonth),
                    ],
                  }
                : current
            )
          }
          onUpdateRule={handleBudgetRuleUpdate}
          onRemoveRule={(id) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    budgetRules: current.budgetRules.filter((rule) => rule.id !== id),
                  }
                : current
            )
          }
          t={onboardingText}
        />
      )}

      {stepKey === "positions" && (
        <StepPositions
          homes={draft.positions.homes}
          cars={draft.positions.cars}
          investments={draft.positions.investments}
          loans={draft.positions.loans}
          housingCostsIncluded={housingCostsIncluded}
          onHousingCostsIncludedChange={setHousingCostsIncluded}
          onAddHome={() =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    positions: {
                      ...current.positions,
                      homes: [
                        ...current.positions.homes,
                        {
                          id: nanoid(),
                          purchaseMonth: current.settings.baseMonth,
                          purchasePrice: 0,
                          downPayment: 0,
                          annualAppreciationPct: 0,
                          mortgageRatePct: 0,
                          mortgageTermYears: 30,
                          holdingCostMonthly: 0,
                          holdingCostAnnualGrowthPct: 0,
                        },
                      ],
                    },
                  }
                : current
            )
          }
          onAddCar={() =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    positions: {
                      ...current.positions,
                      cars: [
                        ...current.positions.cars,
                        {
                          id: nanoid(),
                          purchaseMonth: current.settings.baseMonth,
                          purchasePrice: 0,
                          downPayment: 0,
                          annualDepreciationRatePct: 0,
                          holdingCostMonthly: 0,
                          holdingCostAnnualGrowthPct: 0,
                          loan: {
                            principal: 0,
                            annualInterestRatePct: 0,
                            termYears: 5,
                          },
                        },
                      ],
                    },
                  }
                : current
            )
          }
          onAddInvestment={() =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    positions: {
                      ...current.positions,
                      investments: [
                        ...current.positions.investments,
                        {
                          id: nanoid(),
                          assetClass: "fund",
                          startMonth: current.settings.baseMonth,
                          initialValue: 0,
                          expectedAnnualReturnPct: 0,
                          monthlyContribution: 0,
                        },
                      ],
                    },
                  }
                : current
            )
          }
          onAddLoan={() =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    positions: {
                      ...current.positions,
                      loans: [
                        ...current.positions.loans,
                        {
                          id: nanoid(),
                          startMonth: current.settings.baseMonth,
                          principal: 0,
                          annualInterestRatePct: 0,
                          termYears: 5,
                          monthlyPayment: 0,
                        },
                      ],
                    },
                  }
                : current
            )
          }
          onUpdateHome={(id, patch) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    positions: {
                      ...current.positions,
                      homes: current.positions.homes.map((home) =>
                        home.id === id ? { ...home, ...patch } : home
                      ),
                    },
                  }
                : current
            )
          }
          onUpdateCar={(id, patch) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    positions: {
                      ...current.positions,
                      cars: current.positions.cars.map((car) =>
                        car.id === id ? { ...car, ...patch } : car
                      ),
                    },
                  }
                : current
            )
          }
          onUpdateInvestment={(id, patch) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    positions: {
                      ...current.positions,
                      investments: current.positions.investments.map((investment) =>
                        investment.id === id ? { ...investment, ...patch } : investment
                      ),
                    },
                  }
                : current
            )
          }
          onUpdateLoan={(id, patch) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    positions: {
                      ...current.positions,
                      loans: current.positions.loans.map((loan) =>
                        loan.id === id ? { ...loan, ...patch } : loan
                      ),
                    },
                  }
                : current
            )
          }
          onRemoveHome={(id) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    positions: {
                      ...current.positions,
                      homes: current.positions.homes.filter((home) => home.id !== id),
                    },
                  }
                : current
            )
          }
          onRemoveCar={(id) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    positions: {
                      ...current.positions,
                      cars: current.positions.cars.filter((car) => car.id !== id),
                    },
                  }
                : current
            )
          }
          onRemoveInvestment={(id) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    positions: {
                      ...current.positions,
                      investments: current.positions.investments.filter(
                        (investment) => investment.id !== id
                      ),
                    },
                  }
                : current
            )
          }
          onRemoveLoan={(id) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    positions: {
                      ...current.positions,
                      loans: current.positions.loans.filter((loan) => loan.id !== id),
                    },
                  }
                : current
            )
          }
          errors={errors}
          t={onboardingText}
        />
      )}

      {stepKey === "income" && (
        <StepIncomeSources
          incomes={draft.incomes}
          members={draft.members}
          errors={errors}
          onAddIncome={() =>
            setDraft((current) => {
              if (!current) {
                return current;
              }
              const eligibleMembers = current.members.filter(
                (member) => member.kind === "person"
              );
              const defaultMember =
                eligibleMembers.length === 1 ? eligibleMembers[0].id : null;
              return {
                ...current,
                incomes: [
                  ...current.incomes,
                  createIncomeDraft(current.settings.baseMonth, defaultMember),
                ],
              };
            })
          }
          onUpdateIncome={handleIncomeUpdate}
          onRemoveIncome={(id) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    incomes: current.incomes.filter((income) => income.id !== id),
                  }
                : current
            )
          }
          t={onboardingText}
        />
      )}

      {stepKey === "timeline" && (
        <StepTimelineEvents
          events={draft.timelineEvents}
          members={draft.members}
          warnings={overlapWarnings}
          errors={errors}
          onAddEvent={() =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    timelineEvents: [
                      ...current.timelineEvents,
                      createTimelineEventDraft(current.settings.baseMonth),
                    ],
                  }
                : current
            )
          }
          onUpdateEvent={handleEventUpdate}
          onRemoveEvent={(id) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    timelineEvents: current.timelineEvents.filter((event) => event.id !== id),
                  }
                : current
            )
          }
          t={onboardingText}
        />
      )}

      {stepKey === "review" && (
        <StepReviewConfirm
          members={draft.members}
          baseMonth={draft.settings.baseMonth}
          budgetRules={draft.budgetRules}
          events={draft.timelineEvents}
          incomeMonthlyTotal={totalMonthlyIncome}
          budgetMonthlyTotal={totalMonthlyBudget}
          assetsSummary={assetsSummary}
          warnings={overlapWarnings}
          onDisableBudgetRule={(id) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    budgetRules: current.budgetRules.map((rule) =>
                      rule.id === id ? { ...rule, enabled: false } : rule
                    ),
                  }
                : current
            )
          }
          onRemoveEvent={(id) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    timelineEvents: current.timelineEvents.filter((event) => event.id !== id),
                  }
                : current
            )
          }
          onFinish={handleFinish}
          t={onboardingText}
        />
      )}

      <Group justify="space-between">
        <Button variant="subtle" onClick={handleBack} disabled={step === 0}>
          {onboardingText("back")}
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={handleNext}>{onboardingText("next")}</Button>
        ) : null}
      </Group>
    </Stack>
  );
}
