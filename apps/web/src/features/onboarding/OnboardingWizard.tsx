"use client";

import {
  Button,
  Card,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { addMonths } from "../../domain/members/age";
import {
  projectionToOverviewViewModel,
} from "../../engine/adapter";
import { useProjectionWithLedger } from "../../engine/useProjectionWithLedger";
import {
  applyOnboardingDraftToScenario,
  buildDefaultOnboardingDraft,
  type OnboardingDraft,
} from "../../domain/onboarding/applyDraft";
import { isValidMonthStr } from "../../utils/month";
import {
  getActiveScenario,
  useScenarioStore,
  type CarPositionDraft,
  type HomePositionDraft,
  type InvestmentPositionDraft,
} from "../../store/scenarioStore";
import StepBasics from "./steps/StepBasics";
import StepDecisions from "./steps/StepDecisions";
import StepFamily from "./steps/StepFamily";
import StepIncome from "./steps/StepIncome";
import StepLifestyle from "./steps/StepLifestyle";
import StepPersona from "./steps/StepPersona";
import StepReview from "./steps/StepReview";
import { personaLabels, type OnboardingPersona } from "./types";
import { getBaseMonth, getCurrentMonth } from "./utils";

const steps = [
  "Persona",
  "Basics",
  "Income",
  "Lifestyle",
  "Family",
  "Decisions",
  "Review",
];

const personaDefaultHorizon: Record<OnboardingPersona, number> = {
  A: 60,
  B: 120,
  C: 240,
  D: 240,
  E: 240,
};

export default function OnboardingWizard() {
  const router = useRouter();
  const locale = useLocale();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const updateScenarioAssumptions = useScenarioStore(
    (state) => state.updateScenarioAssumptions
  );
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
  const removeCarPosition = useScenarioStore((state) => state.removeCarPosition);
  const addHomePosition = useScenarioStore((state) => state.addHomePosition);
  const updateHomePosition = useScenarioStore((state) => state.updateHomePosition);
  const removeHomePosition = useScenarioStore((state) => state.removeHomePosition);
  const addInvestmentPosition = useScenarioStore((state) => state.addInvestmentPosition);
  const updateInvestmentPosition = useScenarioStore(
    (state) => state.updateInvestmentPosition
  );
  const removeInvestmentPosition = useScenarioStore(
    (state) => state.removeInvestmentPosition
  );
  const addLoanPosition = useScenarioStore((state) => state.addLoanPosition);
  const updateLoanPosition = useScenarioStore((state) => state.updateLoanPosition);
  const removeLoanPosition = useScenarioStore((state) => state.removeLoanPosition);
  const upsertScenarioMember = useScenarioStore((state) => state.upsertScenarioMember);
  const removeScenarioMember = useScenarioStore((state) => state.removeScenarioMember);
  const addBudgetRule = useScenarioStore((state) => state.addBudgetRule);
  const updateBudgetRuleAction = useScenarioStore((state) => state.updateBudgetRule);
  const removeBudgetRule = useScenarioStore((state) => state.removeBudgetRule);

  const scenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [noCarToggle, setNoCarToggle] = useState(false);
  const [delayHomeToggle, setDelayHomeToggle] = useState(false);
  const [extraInvestToggle, setExtraInvestToggle] = useState(false);
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);

  const draftScenarioIdRef = useRef<string | null>(null);

  const carBackupRef = useRef<CarPositionDraft[] | null>(null);
  const homeBackupRef = useRef<HomePositionDraft[] | null>(null);
  const investmentBackupRef = useRef<InvestmentPositionDraft[] | null>(null);

  useEffect(() => {
    if (!scenario) {
      return;
    }
    if (draftScenarioIdRef.current !== scenario.id) {
      const baseMonth = getBaseMonth(scenario);
      setDraft(buildDefaultOnboardingDraft(scenario, eventLibrary, baseMonth));
      draftScenarioIdRef.current = scenario.id;
    }
  }, [eventLibrary, scenario]);

  const persona = draft?.persona;
  const baseMonth = draft?.basics.baseMonth ?? getCurrentMonth();

  const preview = useProjectionWithLedger(scenario ?? null, eventLibrary);
  const previewSeries = useMemo(() => {
    const overview = preview.projection
      ? projectionToOverviewViewModel(preview.projection)
      : null;
    return overview?.netWorthSeries ?? [];
  }, [preview.projection]);

  if (!scenario || !draft) {
    return null;
  }

  const setError = (key: string, message: string) => {
    setErrors((current) => ({ ...current, [key]: message }));
  };

  const clearError = (key: string) => {
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const validateStep = (index: number) => {
    const nextErrors: Record<string, string> = {};

    if (index === 0) {
      if (!draft.persona) {
        nextErrors.persona = "請選擇一個人生階段";
      }
    }

    if (index === 1) {
      if (!draft.basics.baseMonth) {
        nextErrors.baseMonth = "請選擇起始月份";
      } else if (!isValidMonthStr(draft.basics.baseMonth)) {
        nextErrors.baseMonth = "月份格式必須為 YYYY-MM";
      }
      if (draft.basics.initialCash < 0) {
        nextErrors.initialCash = "起始現金不可少於 0";
      }
    }

    if (index === 2) {
      const monthlyIncome = Number(draft.income.monthlyAmount ?? 0);
      if (monthlyIncome <= 0) {
        nextErrors.monthlyIncome = "請輸入每月收入";
      }
      if (draft.persona === "D") {
        const retirementMonth = draft.income.retirementMonth;
        if (!retirementMonth || !isValidMonthStr(retirementMonth)) {
          nextErrors.retirementMonth = "請輸入退休月份";
        }
      }
      if (draft.persona === "E") {
        const retirementMonth = draft.income.retirementMonth;
        if (retirementMonth && !isValidMonthStr(retirementMonth)) {
          nextErrors.retirementMonth = "月份格式必須為 YYYY-MM";
        }
      }
    }

    if (index === 3) {
      if (draft.lifestyle.rentEnabled) {
        const rentMonthly = Number(draft.lifestyle.rentMonthly ?? 0);
        if (rentMonthly <= 0) {
          nextErrors.rentMonthly = "請輸入每月租金";
        }
        if (
          !draft.lifestyle.rentStartMonth ||
          !isValidMonthStr(draft.lifestyle.rentStartMonth)
        ) {
          nextErrors.rentStartMonth = "請輸入租屋開始月份";
        }
        if (draft.lifestyle.rentDurationYears !== undefined && draft.lifestyle.rentDurationYears < 0) {
          nextErrors.rentDurationYears = "租期不可少於 0";
        }
      }
      if (draft.lifestyle.carEnabled) {
        if (!isValidMonthStr(draft.lifestyle.car.purchaseMonth)) {
          nextErrors.carPurchaseMonth = "請輸入買車月份";
        }
        if (draft.lifestyle.car.purchasePrice <= 0) {
          nextErrors.carPurchasePrice = "請輸入車價";
        }
        if (draft.lifestyle.car.downPayment < 0) {
          nextErrors.carDownPayment = "首期不可少於 0";
        }
      }
      if (draft.lifestyle.travelEnabled) {
        const travelAnnual = Number(draft.lifestyle.travelAnnualBudget ?? 0);
        if (travelAnnual <= 0) {
          nextErrors.travelAnnualBudget = "請輸入旅行預算";
        }
      }
    }

    if (index === 4) {
      if (
        draft.family.childEnabled &&
        (!draft.family.childBirthMonth || !isValidMonthStr(draft.family.childBirthMonth))
      ) {
        nextErrors.childBirthMonth = "請輸入小朋友出生月份";
      }
      if (draft.family.parentEnabled && draft.family.parentMonthlyCost <= 0) {
        nextErrors.parentMonthlyCost = "請輸入父母支援金";
      }
      if (draft.family.petEnabled && draft.family.petMonthlyCost <= 0) {
        nextErrors.petMonthlyCost = "請輸入寵物每月成本";
      }
    }

    if (index === 5) {
      if (draft.decisions.homeEnabled) {
        if (!draft.decisions.home.purchaseMonth || !isValidMonthStr(draft.decisions.home.purchaseMonth)) {
          nextErrors.homePurchaseMonth = "請輸入買樓月份";
        }
        if (!draft.decisions.home.purchasePrice || draft.decisions.home.purchasePrice <= 0) {
          nextErrors.homePurchasePrice = "請輸入樓價";
        }
        if (draft.decisions.home.downPaymentPct < 0) {
          nextErrors.homeDownPaymentPct = "首期不可少於 0";
        }
      }
      if (draft.decisions.investmentEnabled) {
        if (!isValidMonthStr(draft.decisions.investment.startMonth)) {
          nextErrors.investmentStartMonth = "請輸入投資開始月份";
        }
        if (
          !draft.decisions.investment.monthlyContribution ||
          draft.decisions.investment.monthlyContribution <= 0
        ) {
          nextErrors.investmentMonthly = "請輸入每月投資額";
        }
      }
      if (draft.decisions.loanEnabled) {
        if (!isValidMonthStr(draft.decisions.loan.startMonth)) {
          nextErrors.loanStartMonth = "請輸入貸款開始月份";
        }
        if (draft.decisions.loan.principal <= 0) {
          nextErrors.loanPrincipal = "請輸入貸款本金";
        }
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) {
      return;
    }
    applyOnboardingDraftToScenario(scenario, draft, {
      updateScenarioAssumptions,
      updateScenarioClientComputed,
      upsertEventDefinition,
      upsertScenarioEventRef,
      removeScenarioEventRef,
      removeEventDefinition,
      addCarPosition,
      updateCarPosition,
      removeCarPosition,
      addHomePosition,
      updateHomePosition,
      removeHomePosition,
      addInvestmentPosition,
      updateInvestmentPosition,
      removeInvestmentPosition,
      addLoanPosition,
      updateLoanPosition,
      removeLoanPosition,
      upsertScenarioMember,
      removeScenarioMember,
      addBudgetRule,
      updateBudgetRule: updateBudgetRuleAction,
      removeBudgetRule,
    });
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleBack = () => {
    setStep((current) => Math.max(current - 1, 0));
  };

  const handlePersonaSelect = (value: OnboardingPersona) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            persona: value,
            basics: {
              ...current.basics,
              horizonMonths: personaDefaultHorizon[value],
            },
          }
        : current
    );
    clearError("persona");
  };

  const handleBaseMonthChange = (value: string) => {
    if (isValidMonthStr(value)) {
      setDraft((current) =>
        current
          ? {
              ...current,
              basics: {
                ...current.basics,
                baseMonth: value,
              },
            }
          : current
      );
      clearError("baseMonth");
    } else {
      setError("baseMonth", "月份格式必須為 YYYY-MM");
    }
  };

  const handleIncomeChange = (patch: {
    monthlyAmount?: number;
    annualGrowthPct?: number;
    retirementMonth?: string | null;
  }) => {
    const monthlyAmount = patch.monthlyAmount ?? draft.income.monthlyAmount;
    const annualGrowthPct = patch.annualGrowthPct ?? draft.income.annualGrowthPct;
    const retirementMonth = patch.retirementMonth ?? draft.income.retirementMonth;

    if (retirementMonth && !isValidMonthStr(retirementMonth)) {
      setError("retirementMonth", "月份格式必須為 YYYY-MM");
    } else {
      clearError("retirementMonth");
    }
    setDraft((current) =>
      current
        ? {
            ...current,
            income: {
              monthlyAmount: Number(monthlyAmount ?? 0),
              annualGrowthPct: annualGrowthPct ?? 0,
              retirementMonth: retirementMonth ?? null,
            },
          }
        : current
    );
  };

  const handleRentChange = (patch: {
    rentMonthly?: number;
    rentStartMonth?: string;
    rentDurationYears?: number;
  }) => {
    const nextStartMonth = patch.rentStartMonth ?? draft.lifestyle.rentStartMonth;
    if (!isValidMonthStr(nextStartMonth)) {
      setError("rentStartMonth", "月份格式必須為 YYYY-MM");
    } else {
      clearError("rentStartMonth");
    }
    setDraft((current) =>
      current
        ? {
            ...current,
            lifestyle: {
              ...current.lifestyle,
              rentMonthly:
                patch.rentMonthly ?? Number(current.lifestyle.rentMonthly ?? 0),
              rentStartMonth: nextStartMonth,
              rentDurationYears:
                patch.rentDurationYears ?? current.lifestyle.rentDurationYears,
            },
          }
        : current
    );
  };

  const handleTravelChange = (annualBudget: number) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            lifestyle: {
              ...current.lifestyle,
              travelAnnualBudget: Number(annualBudget ?? 0),
            },
          }
        : current
    );
  };

  const handlePartnerToggle = (value: boolean) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            family: {
              ...current.family,
              partnerEnabled: value,
            },
          }
        : current
    );
  };

  const handleChildToggle = (value: boolean) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            family: {
              ...current.family,
              childEnabled: value,
              childBirthMonth: value ? current.family.childBirthMonth : "",
            },
          }
        : current
    );
  };

  const handleChildChange = (patch: {
    childBirthMonth?: string;
    childcareStartAge?: number;
    educationStartAge?: number;
    childcareLevel?: "low" | "mid" | "high";
    educationLevel?: "low" | "mid" | "high";
  }) => {
    const birthMonth = patch.childBirthMonth ?? draft.family.childBirthMonth;

    if (patch.childBirthMonth && !isValidMonthStr(patch.childBirthMonth)) {
      setError("childBirthMonth", "月份格式必須為 YYYY-MM");
    } else {
      clearError("childBirthMonth");
    }

    setDraft((current) =>
      current
        ? {
            ...current,
            family: {
              ...current.family,
              childBirthMonth: birthMonth,
              childcareStartAge:
                patch.childcareStartAge ?? current.family.childcareStartAge,
              educationStartAge:
                patch.educationStartAge ?? current.family.educationStartAge,
              childcareLevel: patch.childcareLevel ?? current.family.childcareLevel,
              educationLevel: patch.educationLevel ?? current.family.educationLevel,
            },
          }
        : current
    );
  };

  const handleParentToggle = (value: boolean) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            family: {
              ...current.family,
              parentEnabled: value,
            },
          }
        : current
    );
  };

  const handlePetToggle = (value: boolean) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            family: {
              ...current.family,
              petEnabled: value,
            },
          }
        : current
    );
  };

  const handleHomeToggle = (value: boolean) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            decisions: {
              ...current.decisions,
              homeEnabled: value,
            },
          }
        : current
    );
  };

  const handleInvestmentToggle = (value: boolean) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            decisions: {
              ...current.decisions,
              investmentEnabled: value,
            },
          }
        : current
    );
  };

  const handleLoanToggle = (value: boolean) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            decisions: {
              ...current.decisions,
              loanEnabled: value,
            },
          }
        : current
    );
  };

  const handleFinish = () => {
    applyOnboardingDraftToScenario(scenario, draft, {
      updateScenarioAssumptions,
      updateScenarioClientComputed,
      upsertEventDefinition,
      upsertScenarioEventRef,
      removeScenarioEventRef,
      removeEventDefinition,
      addCarPosition,
      updateCarPosition,
      removeCarPosition,
      addHomePosition,
      updateHomePosition,
      removeHomePosition,
      addInvestmentPosition,
      updateInvestmentPosition,
      removeInvestmentPosition,
      addLoanPosition,
      updateLoanPosition,
      removeLoanPosition,
      upsertScenarioMember,
      removeScenarioMember,
      addBudgetRule,
      updateBudgetRule: updateBudgetRuleAction,
      removeBudgetRule,
    });
    updateScenarioMeta(scenario.id, { onboardingVersion: 1 });
    updateScenarioClientComputed(scenario.id, { onboardingCompleted: true });
    router.push(`/${locale}/overview`);
  };

  const carPosition = scenario.positions?.cars?.[0];
  const homePosition = scenario.positions?.homes?.[0];
  const investmentPosition = scenario.positions?.investments?.[0];

  const incomeMonthly = Number(draft.income.monthlyAmount ?? 0);
  const rentMonthly = Number(draft.lifestyle.rentMonthly ?? 0);
  const travelAnnual = Number(draft.lifestyle.travelAnnualBudget ?? 0);
  const childcareCostLookup = { low: 3000, mid: 6000, high: 9000 };
  const educationCostLookup = { low: 2000, mid: 4500, high: 8000 };
  const childCost = draft.family.childEnabled
    ? childcareCostLookup[draft.family.childcareLevel] +
      educationCostLookup[draft.family.educationLevel]
    : 0;

  const handleNoCarToggle = (value: boolean) => {
    setNoCarToggle(value);
    if (value) {
      if (!carBackupRef.current) {
        carBackupRef.current = scenario.positions?.cars ?? [];
      }
      scenario.positions?.cars?.forEach((car) => removeCarPosition(scenario.id, car.id));
    } else if (carBackupRef.current) {
      carBackupRef.current.forEach((car) => addCarPosition(scenario.id, car));
      carBackupRef.current = null;
    }
  };

  const handleDelayHomeToggle = (value: boolean) => {
    setDelayHomeToggle(value);
    if (value) {
      if (!homeBackupRef.current) {
        homeBackupRef.current = scenario.positions?.homes ?? [];
      }
      scenario.positions?.homes?.forEach((home) => {
        if (!home.purchaseMonth) {
          return;
        }
        const delayed = addMonths(home.purchaseMonth, 24);
        updateHomePosition(scenario.id, { ...home, purchaseMonth: delayed });
      });
    } else if (homeBackupRef.current) {
      homeBackupRef.current.forEach((home) => updateHomePosition(scenario.id, home));
      homeBackupRef.current = null;
    }
  };

  const handleExtraInvestToggle = (value: boolean) => {
    setExtraInvestToggle(value);
    const extraAmount = 1000;
    if (value) {
      if (!investmentBackupRef.current) {
        investmentBackupRef.current = scenario.positions?.investments ?? [];
      }
      scenario.positions?.investments?.forEach((investment) => {
        const updated = {
          ...investment,
          monthlyContribution: (investment.monthlyContribution ?? 0) + extraAmount,
        };
        updateInvestmentPosition(scenario.id, updated);
      });
    } else if (investmentBackupRef.current) {
      investmentBackupRef.current.forEach((investment) =>
        updateInvestmentPosition(scenario.id, investment)
      );
      investmentBackupRef.current = null;
    }
  };

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2}>Onboarding 問卷</Title>
        <Text size="sm" c="dimmed">
          {persona ? personaLabels[persona] : ""}
        </Text>
      </Stack>

      <Card withBorder radius="md" padding="lg">
        <Stack gap="lg">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Step {step + 1} / {steps.length}
            </Text>
            <Text size="xs" c="dimmed">
              {steps[step]}
            </Text>
          </Group>

          {step === 0 && (
            <StepPersona
              value={persona}
              onSelect={handlePersonaSelect}
              error={errors.persona}
            />
          )}

          {step === 1 && (
            <StepBasics
              baseMonth={draft.basics.baseMonth ?? baseMonth}
              initialCash={draft.basics.initialCash}
              horizonMonths={draft.basics.horizonMonths}
              persona={draft.persona}
              errors={errors}
              onBaseMonthChange={handleBaseMonthChange}
              onInitialCashChange={(value) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        basics: {
                          ...current.basics,
                          initialCash: value,
                        },
                      }
                    : current
                )
              }
              onHorizonChange={(value) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        basics: {
                          ...current.basics,
                          horizonMonths: value,
                        },
                      }
                    : current
                )
              }
            />
          )}

          {step === 2 && (
            <StepIncome
              persona={draft.persona}
              monthlyIncome={incomeMonthly}
              annualGrowthPct={draft.income.annualGrowthPct}
              retirementMonth={draft.income.retirementMonth ?? null}
              errors={errors}
              onMonthlyIncomeChange={(value) =>
                handleIncomeChange({ monthlyAmount: value })
              }
              onAnnualGrowthChange={(value) =>
                handleIncomeChange({ annualGrowthPct: value })
              }
              onRetirementMonthChange={(value) =>
                handleIncomeChange({ retirementMonth: value || null })
              }
            />
          )}

          {step === 3 && (
            <StepLifestyle
              rentEnabled={draft.lifestyle.rentEnabled}
              rentMonthly={draft.lifestyle.rentMonthly}
              rentStartMonth={draft.lifestyle.rentStartMonth || baseMonth}
              rentDurationYears={draft.lifestyle.rentDurationYears}
              carEnabled={draft.lifestyle.carEnabled}
              carPurchaseMonth={draft.lifestyle.car.purchaseMonth || baseMonth}
              carPurchasePrice={draft.lifestyle.car.purchasePrice}
              carDownPayment={draft.lifestyle.car.downPayment}
              carLoanTermYears={draft.lifestyle.car.loanTermYears}
              carLoanRatePct={draft.lifestyle.car.loanRatePct}
              carHoldingCostMonthly={draft.lifestyle.car.holdingCostMonthly}
              carDepreciationPct={draft.lifestyle.car.depreciationPct}
              travelEnabled={draft.lifestyle.travelEnabled}
              travelAnnualBudget={travelAnnual}
              errors={errors}
              onRentEnabledChange={(value) => {
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        lifestyle: {
                          ...current.lifestyle,
                          rentEnabled: value,
                        },
                      }
                    : current
                );
              }}
              onRentChange={handleRentChange}
              onCarEnabledChange={(value) => {
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        lifestyle: {
                          ...current.lifestyle,
                          carEnabled: value,
                        },
                      }
                    : current
                );
              }}
              onCarChange={(patch) => {
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        lifestyle: {
                          ...current.lifestyle,
                          car: {
                            purchaseMonth:
                              patch.carPurchaseMonth ?? current.lifestyle.car.purchaseMonth,
                            purchasePrice:
                              patch.carPurchasePrice ??
                              current.lifestyle.car.purchasePrice,
                            downPayment:
                              patch.carDownPayment ?? current.lifestyle.car.downPayment,
                            loanTermYears:
                              patch.carLoanTermYears ??
                              current.lifestyle.car.loanTermYears,
                            loanRatePct:
                              patch.carLoanRatePct ?? current.lifestyle.car.loanRatePct,
                            holdingCostMonthly:
                              patch.carHoldingCostMonthly ??
                              current.lifestyle.car.holdingCostMonthly,
                            depreciationPct:
                              patch.carDepreciationPct ??
                              current.lifestyle.car.depreciationPct,
                          },
                        },
                      }
                    : current
                );
              }}
              onTravelEnabledChange={(value) => {
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        lifestyle: {
                          ...current.lifestyle,
                          travelEnabled: value,
                        },
                      }
                    : current
                );
              }}
              onTravelChange={handleTravelChange}
            />
          )}

          {step === 4 && (
            <StepFamily
              partnerEnabled={draft.family.partnerEnabled}
              partnerName={draft.family.partnerName}
              childEnabled={draft.family.childEnabled}
              childBirthMonth={draft.family.childBirthMonth}
              childcareStartAge={draft.family.childcareStartAge}
              educationStartAge={draft.family.educationStartAge}
              childcareLevel={draft.family.childcareLevel}
              educationLevel={draft.family.educationLevel}
              parentEnabled={draft.family.parentEnabled}
              parentMonthlyCost={draft.family.parentMonthlyCost}
              petEnabled={draft.family.petEnabled}
              petMonthlyCost={draft.family.petMonthlyCost}
              errors={errors}
              onPartnerToggle={handlePartnerToggle}
              onPartnerNameChange={(value) => {
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        family: {
                          ...current.family,
                          partnerName: value,
                        },
                      }
                    : current
                );
              }}
              onChildToggle={handleChildToggle}
              onChildChange={handleChildChange}
              onParentToggle={handleParentToggle}
              onParentMonthlyCostChange={(value) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        family: {
                          ...current.family,
                          parentMonthlyCost: value,
                        },
                      }
                    : current
                )
              }
              onPetToggle={handlePetToggle}
              onPetMonthlyCostChange={(value) => {
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        family: {
                          ...current.family,
                          petMonthlyCost: value,
                        },
                      }
                    : current
                );
              }}
            />
          )}

          {step === 5 && (
            <StepDecisions
              showHome={draft.persona !== "A"}
              showInvestment={draft.persona !== "A"}
              homeEnabled={draft.decisions.homeEnabled}
              homePurchaseMonth={draft.decisions.home.purchaseMonth ?? baseMonth}
              homePurchasePrice={draft.decisions.home.purchasePrice}
              homeDownPaymentPct={draft.decisions.home.downPaymentPct}
              homeTermYears={draft.decisions.home.mortgageTermYears}
              homeRatePct={draft.decisions.home.mortgageRatePct}
              homeFees={draft.decisions.home.feesOneTime}
              homeHoldingCostMonthly={draft.decisions.home.holdingCostMonthly}
              homeAppreciationPct={draft.decisions.home.appreciationPct}
              investmentEnabled={draft.decisions.investmentEnabled}
              investmentMonthly={draft.decisions.investment.monthlyContribution}
              investmentReturnPct={draft.decisions.investment.expectedAnnualReturnPct}
              investmentFeePct={draft.decisions.investment.feeAnnualRatePct}
              investmentStartMonth={draft.decisions.investment.startMonth ?? baseMonth}
              loanEnabled={draft.decisions.loanEnabled}
              loanStartMonth={draft.decisions.loan.startMonth ?? baseMonth}
              loanPrincipal={draft.decisions.loan.principal}
              loanRatePct={draft.decisions.loan.annualInterestRatePct}
              loanTermYears={draft.decisions.loan.termYears}
              loanMonthlyPayment={draft.decisions.loan.monthlyPayment}
              errors={errors}
              onHomeToggle={handleHomeToggle}
              onHomeChange={(patch) => {
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        decisions: {
                          ...current.decisions,
                          home: {
                            ...current.decisions.home,
                            purchaseMonth:
                              patch.homePurchaseMonth ??
                              current.decisions.home.purchaseMonth,
                            purchasePrice:
                              patch.homePurchasePrice ??
                              current.decisions.home.purchasePrice,
                            downPaymentPct:
                              patch.homeDownPaymentPct ??
                              current.decisions.home.downPaymentPct,
                            mortgageTermYears:
                              patch.homeTermYears ??
                              current.decisions.home.mortgageTermYears,
                            mortgageRatePct:
                              patch.homeRatePct ?? current.decisions.home.mortgageRatePct,
                            feesOneTime:
                              patch.homeFees ?? current.decisions.home.feesOneTime,
                            holdingCostMonthly:
                              patch.homeHoldingCostMonthly ??
                              current.decisions.home.holdingCostMonthly,
                            appreciationPct:
                              patch.homeAppreciationPct ??
                              current.decisions.home.appreciationPct,
                          },
                        },
                      }
                    : current
                );
              }}
              onInvestmentToggle={handleInvestmentToggle}
              onInvestmentChange={(patch) => {
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        decisions: {
                          ...current.decisions,
                          investment: {
                            ...current.decisions.investment,
                            startMonth:
                              patch.investmentStartMonth ??
                              current.decisions.investment.startMonth,
                            monthlyContribution:
                              patch.investmentMonthly ??
                              current.decisions.investment.monthlyContribution,
                            expectedAnnualReturnPct:
                              patch.investmentReturnPct ??
                              current.decisions.investment.expectedAnnualReturnPct,
                            feeAnnualRatePct:
                              patch.investmentFeePct ??
                              current.decisions.investment.feeAnnualRatePct,
                          },
                        },
                      }
                    : current
                );
              }}
              onLoanToggle={handleLoanToggle}
              onLoanChange={(patch) => {
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        decisions: {
                          ...current.decisions,
                          loan: {
                            ...current.decisions.loan,
                            startMonth:
                              patch.loanStartMonth ?? current.decisions.loan.startMonth,
                            principal:
                              patch.loanPrincipal ?? current.decisions.loan.principal,
                            annualInterestRatePct:
                              patch.loanRatePct ??
                              current.decisions.loan.annualInterestRatePct,
                            termYears:
                              patch.loanTermYears ?? current.decisions.loan.termYears,
                            monthlyPayment:
                              patch.loanMonthlyPayment ??
                              current.decisions.loan.monthlyPayment,
                          },
                        },
                      }
                    : current
                );
              }}
            />
          )}

          {step === 6 && (
            <StepReview
              incomeMonthly={incomeMonthly}
              rentMonthly={rentMonthly}
              travelAnnual={travelAnnual}
              carMonthlyCost={carPosition?.holdingCostMonthly ?? 0}
              homePurchasePrice={homePosition?.purchasePrice ?? 0}
              investmentMonthly={investmentPosition?.monthlyContribution ?? 0}
              childMonthlyCost={childCost}
              showNoCar={noCarToggle}
              showDelayHome={delayHomeToggle}
              showExtraInvest={extraInvestToggle}
              onNoCarToggle={handleNoCarToggle}
              onDelayHomeToggle={handleDelayHomeToggle}
              onExtraInvestToggle={handleExtraInvestToggle}
              previewSeries={previewSeries}
              onFinish={handleFinish}
            />
          )}

          {step < steps.length - 1 && (
            <Group justify="space-between">
              <Button variant="subtle" onClick={handleBack} disabled={step === 0}>
                返回
              </Button>
              <Button onClick={handleNext}>下一步</Button>
            </Group>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
