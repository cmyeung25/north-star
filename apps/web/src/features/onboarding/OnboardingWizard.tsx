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
import type { EventDefinition } from "../../domain/events/types";
import { addMonths } from "../../domain/members/age";
import {
  projectionToOverviewViewModel,
} from "../../engine/adapter";
import { useProjectionWithLedger } from "../../engine/useProjectionWithLedger";
import { isValidMonthStr } from "../../utils/month";
import {
  getActiveScenario,
  useScenarioStore,
  type BudgetCategory,
  type BudgetRule,
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
import {
  buildOnboardingBudgetRuleId,
  buildOnboardingEventId,
  buildOnboardingMemberId,
  buildOnboardingPositionId,
  computeDurationYears,
  computeEndMonthFromDuration,
  getBaseMonth,
  getCurrentMonth,
} from "./utils";

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

const childcarePreset = { low: 3000, mid: 6000, high: 9000 };
const educationPreset = { low: 2000, mid: 4500, high: 8000 };

const updateBudgetRule = (
  rule: BudgetRule,
  patch: Partial<BudgetRule>
): BudgetRule => ({
  ...rule,
  ...patch,
  ageBand: patch.ageBand ? { ...rule.ageBand, ...patch.ageBand } : rule.ageBand,
});

const getBudgetRule = (
  rules: BudgetRule[] | undefined,
  category: BudgetCategory,
  memberId?: string
) =>
  rules?.find(
    (rule) => rule.category === category && (memberId ? rule.memberId === memberId : true)
  );

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
  const [rentDurationYears, setRentDurationYears] = useState<number | undefined>();
  const [childcareLevel, setChildcareLevel] = useState<"low" | "mid" | "high">("mid");
  const [educationLevel, setEducationLevel] = useState<"low" | "mid" | "high">("mid");
  const [noCarToggle, setNoCarToggle] = useState(false);
  const [delayHomeToggle, setDelayHomeToggle] = useState(false);
  const [extraInvestToggle, setExtraInvestToggle] = useState(false);

  const carBackupRef = useRef<CarPositionDraft[] | null>(null);
  const homeBackupRef = useRef<HomePositionDraft[] | null>(null);
  const investmentBackupRef = useRef<InvestmentPositionDraft[] | null>(null);

  useEffect(() => {
    if (!scenario) {
      return;
    }
    if (!scenario.assumptions.baseMonth) {
      updateScenarioAssumptions(scenario.id, { baseMonth: getCurrentMonth() });
    }
  }, [scenario, updateScenarioAssumptions]);

  const persona = scenario?.clientComputed?.onboardingPersona;

  const incomeEventId = scenario
    ? buildOnboardingEventId(scenario.id, "income")
    : "";
  const rentEventId = scenario ? buildOnboardingEventId(scenario.id, "rent") : "";
  const travelEventId = scenario ? buildOnboardingEventId(scenario.id, "travel") : "";

  const incomeEvent = eventLibrary.find((event) => event.id === incomeEventId);
  const rentEvent = eventLibrary.find((event) => event.id === rentEventId);
  const travelEvent = eventLibrary.find((event) => event.id === travelEventId);
  const rentEventRef = scenario.eventRefs?.find((ref) => ref.refId === rentEventId);
  const travelEventRef = scenario.eventRefs?.find((ref) => ref.refId === travelEventId);

  useEffect(() => {
    if (!rentEvent?.rule.startMonth) {
      return;
    }
    setRentDurationYears(
      computeDurationYears(rentEvent.rule.startMonth, rentEvent.rule.endMonth)
    );
  }, [rentEvent?.rule.startMonth, rentEvent?.rule.endMonth]);

  const baseMonth = scenario ? getBaseMonth(scenario) : getCurrentMonth();

  const preview = useProjectionWithLedger(scenario ?? null, eventLibrary);
  const previewSeries = useMemo(() => {
    const overview = preview.projection
      ? projectionToOverviewViewModel(preview.projection)
      : null;
    return overview?.netWorthSeries ?? [];
  }, [preview.projection]);

  if (!scenario) {
    return null;
  }

  const upsertEvent = (definition: EventDefinition) => {
    upsertEventDefinition(definition);
    upsertScenarioEventRef(scenario.id, { refId: definition.id, enabled: true });
  };

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
      if (!persona) {
        nextErrors.persona = "請選擇一個人生階段";
      }
    }

    if (index === 1) {
      if (!scenario.assumptions.baseMonth) {
        nextErrors.baseMonth = "請選擇起始月份";
      } else if (!isValidMonthStr(scenario.assumptions.baseMonth)) {
        nextErrors.baseMonth = "月份格式必須為 YYYY-MM";
      }
      if (scenario.assumptions.initialCash < 0) {
        nextErrors.initialCash = "起始現金不可少於 0";
      }
    }

    if (index === 2) {
      const monthlyIncome = Number(incomeEvent?.rule.monthlyAmount ?? 0);
      if (monthlyIncome <= 0) {
        nextErrors.monthlyIncome = "請輸入每月收入";
      }
      if (persona === "D") {
        const retirementMonth = incomeEvent?.rule.endMonth;
        if (!retirementMonth || !isValidMonthStr(retirementMonth)) {
          nextErrors.retirementMonth = "請輸入退休月份";
        }
      }
      if (persona === "E") {
        const retirementMonth = incomeEvent?.rule.endMonth;
        if (retirementMonth && !isValidMonthStr(retirementMonth)) {
          nextErrors.retirementMonth = "月份格式必須為 YYYY-MM";
        }
      }
    }

    if (index === 3) {
      if (rentEventRef?.enabled && rentEvent) {
        const rentMonthly = Number(rentEvent.rule.monthlyAmount ?? 0);
        if (rentMonthly <= 0) {
          nextErrors.rentMonthly = "請輸入每月租金";
        }
        if (!rentEvent.rule.startMonth || !isValidMonthStr(rentEvent.rule.startMonth)) {
          nextErrors.rentStartMonth = "請輸入租屋開始月份";
        }
        if (rentDurationYears !== undefined && rentDurationYears < 0) {
          nextErrors.rentDurationYears = "租期不可少於 0";
        }
      }
      const carPosition = scenario.positions?.cars?.[0];
      if (carPosition) {
        if (!isValidMonthStr(carPosition.purchaseMonth)) {
          nextErrors.carPurchaseMonth = "請輸入買車月份";
        }
        if (carPosition.purchasePrice <= 0) {
          nextErrors.carPurchasePrice = "請輸入車價";
        }
        if (carPosition.downPayment < 0) {
          nextErrors.carDownPayment = "首期不可少於 0";
        }
      }
      if (travelEventRef?.enabled && travelEvent) {
        const travelMonthly = Number(travelEvent.rule.monthlyAmount ?? 0);
        if (travelMonthly <= 0) {
          nextErrors.travelAnnualBudget = "請輸入旅行預算";
        }
      }
    }

    if (index === 4) {
      const childMember = scenario.members?.find(
        (member) => member.id === buildOnboardingMemberId(scenario.id, "child")
      );
      if (childMember && (!childMember.birthMonth || !isValidMonthStr(childMember.birthMonth))) {
        nextErrors.childBirthMonth = "請輸入小朋友出生月份";
      }
      const elderRule = getBudgetRule(scenario.budgetRules, "eldercare");
      if (elderRule && elderRule.monthlyAmount <= 0) {
        nextErrors.parentMonthlyCost = "請輸入父母支援金";
      }
      const petRule = getBudgetRule(
        scenario.budgetRules,
        "petcare",
        buildOnboardingMemberId(scenario.id, "pet")
      );
      if (petRule && petRule.monthlyAmount <= 0) {
        nextErrors.petMonthlyCost = "請輸入寵物每月成本";
      }
    }

    if (index === 5) {
      const home = scenario.positions?.homes?.[0];
      if (home) {
        if (!home.purchaseMonth || !isValidMonthStr(home.purchaseMonth)) {
          nextErrors.homePurchaseMonth = "請輸入買樓月份";
        }
        if (!home.purchasePrice || home.purchasePrice <= 0) {
          nextErrors.homePurchasePrice = "請輸入樓價";
        }
        if (home.downPayment !== undefined && home.downPayment < 0) {
          nextErrors.homeDownPaymentPct = "首期不可少於 0";
        }
      }
      const investment = scenario.positions?.investments?.[0];
      if (investment) {
        if (!isValidMonthStr(investment.startMonth)) {
          nextErrors.investmentStartMonth = "請輸入投資開始月份";
        }
        if (!investment.monthlyContribution || investment.monthlyContribution <= 0) {
          nextErrors.investmentMonthly = "請輸入每月投資額";
        }
      }
      const loan = scenario.positions?.loans?.[0];
      if (loan) {
        if (!isValidMonthStr(loan.startMonth)) {
          nextErrors.loanStartMonth = "請輸入貸款開始月份";
        }
        if (loan.principal <= 0) {
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
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleBack = () => {
    setStep((current) => Math.max(current - 1, 0));
  };

  const handlePersonaSelect = (value: OnboardingPersona) => {
    updateScenarioClientComputed(scenario.id, { onboardingPersona: value });
    updateScenarioAssumptions(scenario.id, {
      horizonMonths: personaDefaultHorizon[value],
      includeBudgetRulesInProjection: true,
    });
    clearError("persona");
  };

  const handleBaseMonthChange = (value: string) => {
    if (isValidMonthStr(value)) {
      updateScenarioAssumptions(scenario.id, { baseMonth: value });
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
    const monthlyAmount = patch.monthlyAmount ?? Number(incomeEvent?.rule.monthlyAmount ?? 0);
    const annualGrowthPct = patch.annualGrowthPct ?? incomeEvent?.rule.annualGrowthPct;
    const retirementMonth = patch.retirementMonth ?? incomeEvent?.rule.endMonth ?? null;

    if (retirementMonth && !isValidMonthStr(retirementMonth)) {
      setError("retirementMonth", "月份格式必須為 YYYY-MM");
    } else {
      clearError("retirementMonth");
    }

    const definition: EventDefinition = {
      id: incomeEventId,
      title: "Onboarding Income",
      type: "salary",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: baseMonth,
        endMonth: retirementMonth,
        monthlyAmount: Number(monthlyAmount ?? 0),
        oneTimeAmount: 0,
        annualGrowthPct: annualGrowthPct ?? 0,
      },
      currency: scenario.baseCurrency,
    };

    upsertEvent(definition);
  };

  const handleRentChange = (patch: {
    rentMonthly?: number;
    rentStartMonth?: string;
    rentDurationYears?: number;
  }) => {
    const nextStartMonth = patch.rentStartMonth ?? rentEvent?.rule.startMonth ?? baseMonth;
    if (!isValidMonthStr(nextStartMonth)) {
      setError("rentStartMonth", "月份格式必須為 YYYY-MM");
    } else {
      clearError("rentStartMonth");
    }

    if (patch.rentDurationYears !== undefined) {
      setRentDurationYears(patch.rentDurationYears);
    }

    const endMonth = computeEndMonthFromDuration(
      nextStartMonth,
      patch.rentDurationYears ?? rentDurationYears
    );

    const definition: EventDefinition = {
      id: rentEventId,
      title: "Onboarding Rent",
      type: "rent",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: nextStartMonth,
        endMonth,
        monthlyAmount: Number(patch.rentMonthly ?? rentEvent?.rule.monthlyAmount ?? 0),
        oneTimeAmount: 0,
        annualGrowthPct: rentEvent?.rule.annualGrowthPct ?? 0,
      },
      currency: scenario.baseCurrency,
    };

    upsertEvent(definition);
  };

  const handleTravelChange = (annualBudget: number) => {
    const monthlyAmount = Number(annualBudget ?? 0) / 12;
    const definition: EventDefinition = {
      id: travelEventId,
      title: "Onboarding Travel",
      type: "travel",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: baseMonth,
        endMonth: null,
        monthlyAmount,
        oneTimeAmount: 0,
        annualGrowthPct: travelEvent?.rule.annualGrowthPct ?? 0,
      },
      currency: scenario.baseCurrency,
    };

    upsertEvent(definition);
  };

  const upsertBudgetRuleForCategory = (
    category: BudgetCategory,
    memberId: string | undefined,
    monthlyAmount: number,
    ageBand: BudgetRule["ageBand"],
    startMonth?: string,
    endMonth?: string
  ) => {
    const ruleId = buildOnboardingBudgetRuleId(scenario.id, category, memberId);
    const existingRule = scenario.budgetRules?.find((rule) => rule.id === ruleId);
    const payload: BudgetRule = existingRule
      ? updateBudgetRule(existingRule, {
          memberId,
          category,
          monthlyAmount,
          ageBand,
          startMonth,
          endMonth,
        })
      : {
          id: ruleId,
          name: category,
          enabled: true,
          memberId,
          category,
          ageBand,
          monthlyAmount,
          startMonth,
          endMonth,
        };

    if (existingRule) {
      updateBudgetRuleAction(scenario.id, payload.id, payload);
    } else {
      addBudgetRule(scenario.id, payload);
    }
  };

  const handlePartnerToggle = (value: boolean) => {
    const partnerId = buildOnboardingMemberId(scenario.id, "partner");
    if (value) {
      upsertScenarioMember(scenario.id, {
        id: partnerId,
        name: "伴侶",
        kind: "person",
      });
    } else {
      removeScenarioMember(scenario.id, partnerId);
    }
  };

  const handleChildToggle = (value: boolean) => {
    const childId = buildOnboardingMemberId(scenario.id, "child");
    if (value) {
      upsertScenarioMember(scenario.id, {
        id: childId,
        name: "小朋友",
        kind: "person",
        birthMonth: baseMonth,
      });
    } else {
      removeScenarioMember(scenario.id, childId);
      scenario.budgetRules
        ?.filter((rule) => rule.memberId === childId)
        .forEach((rule) => removeBudgetRule(scenario.id, rule.id));
    }
  };

  const handleChildChange = (patch: {
    childBirthMonth?: string;
    childcareStartAge?: number;
    educationStartAge?: number;
    childcareLevel?: "low" | "mid" | "high";
    educationLevel?: "low" | "mid" | "high";
  }) => {
    const childId = buildOnboardingMemberId(scenario.id, "child");
    const childMember = scenario.members?.find((member) => member.id === childId);
    const birthMonth = patch.childBirthMonth ?? childMember?.birthMonth ?? baseMonth;
    const existingChildcareStart =
      getBudgetRule(scenario.budgetRules, "childcare", childId)?.ageBand.fromYears ?? 0;
    const existingEducationStart =
      getBudgetRule(scenario.budgetRules, "education", childId)?.ageBand.fromYears ?? 6;

    if (patch.childBirthMonth && !isValidMonthStr(patch.childBirthMonth)) {
      setError("childBirthMonth", "月份格式必須為 YYYY-MM");
    } else {
      clearError("childBirthMonth");
    }

    upsertScenarioMember(scenario.id, {
      id: childId,
      name: "小朋友",
      kind: "person",
      birthMonth,
    });

    const childcareStart = patch.childcareStartAge ?? existingChildcareStart;
    const educationStart = patch.educationStartAge ?? existingEducationStart;

    const nextChildcareLevel = patch.childcareLevel ?? childcareLevel;
    const nextEducationLevel = patch.educationLevel ?? educationLevel;

    if (patch.childcareLevel) {
      setChildcareLevel(patch.childcareLevel);
    }
    if (patch.educationLevel) {
      setEducationLevel(patch.educationLevel);
    }

    const childcareStartMonth = isValidMonthStr(birthMonth)
      ? addMonths(birthMonth, Math.round(childcareStart * 12))
      : undefined;
    const childcareEndMonth = isValidMonthStr(birthMonth)
      ? addMonths(birthMonth, 6 * 12)
      : undefined;

    const educationStartMonth = isValidMonthStr(birthMonth)
      ? addMonths(birthMonth, Math.round(educationStart * 12))
      : undefined;
    const educationEndMonth = isValidMonthStr(birthMonth)
      ? addMonths(birthMonth, 18 * 12)
      : undefined;

    upsertBudgetRuleForCategory(
      "childcare",
      childId,
      childcarePreset[nextChildcareLevel],
      { fromYears: childcareStart, toYears: 6 },
      childcareStartMonth,
      childcareEndMonth
    );

    upsertBudgetRuleForCategory(
      "education",
      childId,
      educationPreset[nextEducationLevel],
      { fromYears: educationStart, toYears: 18 },
      educationStartMonth,
      educationEndMonth
    );
  };

  const handleParentToggle = (value: boolean) => {
    const elderRule = getBudgetRule(scenario.budgetRules, "eldercare");
    if (value) {
      upsertBudgetRuleForCategory(
        "eldercare",
        undefined,
        elderRule?.monthlyAmount ?? 5000,
        { fromYears: 0, toYears: 120 },
        baseMonth
      );
    } else if (elderRule) {
      removeBudgetRule(scenario.id, elderRule.id);
    }
  };

  const handlePetToggle = (value: boolean) => {
    const petId = buildOnboardingMemberId(scenario.id, "pet");
    const petRule = getBudgetRule(scenario.budgetRules, "petcare", petId);
    if (value) {
      upsertScenarioMember(scenario.id, {
        id: petId,
        name: "寵物",
        kind: "pet",
      });
      upsertBudgetRuleForCategory(
        "petcare",
        petId,
        petRule?.monthlyAmount ?? 1200,
        { fromYears: 0, toYears: 40 },
        baseMonth
      );
    } else {
      removeScenarioMember(scenario.id, petId);
      if (petRule) {
        removeBudgetRule(scenario.id, petRule.id);
      }
    }
  };

  const handleHomeToggle = (value: boolean) => {
    const homeId = buildOnboardingPositionId(scenario.id, "home");
    if (value) {
      const existingHome = scenario.positions?.homes?.[0];
      if (!existingHome) {
        addHomePosition(scenario.id, {
          id: homeId,
          purchasePrice: 0,
          downPayment: 0,
          purchaseMonth: baseMonth,
          annualAppreciationPct: 3,
          mortgageRatePct: 4,
          mortgageTermYears: 30,
          feesOneTime: 0,
          holdingCostMonthly: 0,
          holdingCostAnnualGrowthPct: 0,
        });
      }
    } else if (scenario.positions?.homes?.length) {
      scenario.positions.homes.forEach((home) => removeHomePosition(scenario.id, home.id));
    }
  };

  const handleInvestmentToggle = (value: boolean) => {
    const investmentId = buildOnboardingPositionId(scenario.id, "investment");
    if (value) {
      const existingInvestment = scenario.positions?.investments?.[0];
      if (!existingInvestment) {
        addInvestmentPosition(scenario.id, {
          id: investmentId,
          assetClass: "fund",
          startMonth: baseMonth,
          initialValue: 0,
          expectedAnnualReturnPct: 5,
          monthlyContribution: 0,
        });
      }
    } else if (scenario.positions?.investments?.length) {
      scenario.positions.investments.forEach((investment) =>
        removeInvestmentPosition(scenario.id, investment.id)
      );
    }
  };

  const handleLoanToggle = (value: boolean) => {
    const loanId = buildOnboardingPositionId(scenario.id, "loan");
    if (value) {
      const existingLoan = scenario.positions?.loans?.[0];
      if (!existingLoan) {
        addLoanPosition(scenario.id, {
          id: loanId,
          startMonth: baseMonth,
          principal: 0,
          annualInterestRatePct: 4,
          termYears: 5,
          monthlyPayment: undefined,
        });
      }
    } else if (scenario.positions?.loans?.length) {
      scenario.positions.loans.forEach((loan) => removeLoanPosition(scenario.id, loan.id));
    }
  };

  const handleFinish = () => {
    updateScenarioMeta(scenario.id, { onboardingVersion: 1 });
    updateScenarioClientComputed(scenario.id, { onboardingCompleted: true });
    router.push(`/${locale}/overview`);
  };

  const carPosition = scenario.positions?.cars?.[0];
  const homePosition = scenario.positions?.homes?.[0];
  const investmentPosition = scenario.positions?.investments?.[0];
  const loanPosition = scenario.positions?.loans?.[0];

  const incomeMonthly = Number(incomeEvent?.rule.monthlyAmount ?? 0);
  const rentMonthly = Number(rentEvent?.rule.monthlyAmount ?? 0);
  const travelAnnual = Number(travelEvent?.rule.monthlyAmount ?? 0) * 12;
  const childCost =
    scenario.budgetRules
      ?.filter((rule) => rule.category === "childcare" || rule.category === "education")
      .reduce((total, rule) => total + Number(rule.monthlyAmount ?? 0), 0) ?? 0;

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
              baseMonth={scenario.assumptions.baseMonth ?? baseMonth}
              initialCash={scenario.assumptions.initialCash}
              horizonMonths={scenario.assumptions.horizonMonths}
              persona={persona}
              errors={errors}
              onBaseMonthChange={handleBaseMonthChange}
              onInitialCashChange={(value) =>
                updateScenarioAssumptions(scenario.id, { initialCash: value })
              }
              onHorizonChange={(value) =>
                updateScenarioAssumptions(scenario.id, { horizonMonths: value })
              }
            />
          )}

          {step === 2 && (
            <StepIncome
              persona={persona}
              monthlyIncome={incomeMonthly}
              annualGrowthPct={incomeEvent?.rule.annualGrowthPct}
              retirementMonth={incomeEvent?.rule.endMonth ?? null}
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
              rentEnabled={Boolean(rentEventRef?.enabled)}
              rentMonthly={Number(rentEvent?.rule.monthlyAmount ?? 0)}
              rentStartMonth={rentEvent?.rule.startMonth ?? baseMonth}
              rentDurationYears={rentDurationYears}
              carEnabled={Boolean(carPosition)}
              carPurchaseMonth={carPosition?.purchaseMonth ?? baseMonth}
              carPurchasePrice={carPosition?.purchasePrice ?? 0}
              carDownPayment={carPosition?.downPayment ?? 0}
              carLoanTermYears={carPosition?.loan?.termYears ?? 5}
              carLoanRatePct={carPosition?.loan?.annualInterestRatePct ?? 4}
              carHoldingCostMonthly={carPosition?.holdingCostMonthly ?? 0}
              carDepreciationPct={carPosition?.annualDepreciationRatePct ?? 12}
              travelEnabled={Boolean(travelEventRef?.enabled)}
              travelAnnualBudget={travelAnnual}
              errors={errors}
              onRentEnabledChange={(value) => {
                if (!value) {
                  if (rentEvent) {
                    upsertScenarioEventRef(scenario.id, {
                      refId: rentEvent.id,
                      enabled: false,
                    });
                  }
                  return;
                }
                if (rentEvent) {
                  upsertScenarioEventRef(scenario.id, {
                    refId: rentEvent.id,
                    enabled: true,
                  });
                  return;
                }
                handleRentChange({ rentMonthly: 0 });
              }}
              onRentChange={handleRentChange}
              onCarEnabledChange={(value) => {
                if (!value) {
                  if (carPosition) {
                    removeCarPosition(scenario.id, carPosition.id);
                  }
                  return;
                }
                addCarPosition(scenario.id, {
                  id: buildOnboardingPositionId(scenario.id, "car"),
                  purchaseMonth: baseMonth,
                  purchasePrice: 0,
                  downPayment: 0,
                  annualDepreciationRatePct: 12,
                  holdingCostMonthly: 0,
                  holdingCostAnnualGrowthPct: 0,
                  loan: {
                    principal: 0,
                    annualInterestRatePct: 4,
                    termYears: 5,
                  },
                });
              }}
              onCarChange={(patch) => {
                if (!carPosition) {
                  return;
                }
                updateCarPosition(scenario.id, {
                  ...carPosition,
                  purchaseMonth: patch.carPurchaseMonth ?? carPosition.purchaseMonth,
                  purchasePrice: patch.carPurchasePrice ?? carPosition.purchasePrice,
                  downPayment: patch.carDownPayment ?? carPosition.downPayment,
                  annualDepreciationRatePct:
                    patch.carDepreciationPct ?? carPosition.annualDepreciationRatePct,
                  holdingCostMonthly:
                    patch.carHoldingCostMonthly ?? carPosition.holdingCostMonthly,
                  holdingCostAnnualGrowthPct: carPosition.holdingCostAnnualGrowthPct ?? 0,
                  loan: {
                    principal: carPosition.loan?.principal ?? 0,
                    annualInterestRatePct:
                      patch.carLoanRatePct ?? carPosition.loan?.annualInterestRatePct ?? 4,
                    termYears:
                      patch.carLoanTermYears ?? carPosition.loan?.termYears ?? 5,
                    monthlyPayment: carPosition.loan?.monthlyPayment,
                  },
                });
              }}
              onTravelEnabledChange={(value) => {
                if (!value) {
                  if (travelEvent) {
                    upsertScenarioEventRef(scenario.id, {
                      refId: travelEvent.id,
                      enabled: false,
                    });
                  }
                  return;
                }
                if (travelEvent) {
                  upsertScenarioEventRef(scenario.id, {
                    refId: travelEvent.id,
                    enabled: true,
                  });
                  return;
                }
                handleTravelChange(travelAnnual);
              }}
              onTravelChange={handleTravelChange}
            />
          )}

          {step === 4 && (
            <StepFamily
              partnerEnabled={Boolean(
                scenario.members?.find(
                  (member) => member.id === buildOnboardingMemberId(scenario.id, "partner")
                )
              )}
              partnerName={
                scenario.members?.find(
                  (member) => member.id === buildOnboardingMemberId(scenario.id, "partner")
                )?.name ?? ""
              }
              childEnabled={Boolean(
                scenario.members?.find(
                  (member) => member.id === buildOnboardingMemberId(scenario.id, "child")
                )
              )}
              childBirthMonth={
                scenario.members?.find(
                  (member) => member.id === buildOnboardingMemberId(scenario.id, "child")
                )?.birthMonth ?? ""
              }
              childcareStartAge={
                getBudgetRule(
                  scenario.budgetRules,
                  "childcare",
                  buildOnboardingMemberId(scenario.id, "child")
                )?.ageBand.fromYears ?? 0
              }
              educationStartAge={
                getBudgetRule(
                  scenario.budgetRules,
                  "education",
                  buildOnboardingMemberId(scenario.id, "child")
                )?.ageBand.fromYears ?? 6
              }
              childcareLevel={childcareLevel}
              educationLevel={educationLevel}
              parentEnabled={Boolean(getBudgetRule(scenario.budgetRules, "eldercare"))}
              parentMonthlyCost={
                getBudgetRule(scenario.budgetRules, "eldercare")?.monthlyAmount ?? 0
              }
              petEnabled={Boolean(
                getBudgetRule(
                  scenario.budgetRules,
                  "petcare",
                  buildOnboardingMemberId(scenario.id, "pet")
                )
              )}
              petMonthlyCost={
                getBudgetRule(
                  scenario.budgetRules,
                  "petcare",
                  buildOnboardingMemberId(scenario.id, "pet")
                )?.monthlyAmount ?? 0
              }
              errors={errors}
              onPartnerToggle={handlePartnerToggle}
              onPartnerNameChange={(value) => {
                const partnerId = buildOnboardingMemberId(scenario.id, "partner");
                upsertScenarioMember(scenario.id, {
                  id: partnerId,
                  name: value,
                  kind: "person",
                });
              }}
              onChildToggle={handleChildToggle}
              onChildChange={handleChildChange}
              onParentToggle={handleParentToggle}
              onParentMonthlyCostChange={(value) =>
                upsertBudgetRuleForCategory(
                  "eldercare",
                  undefined,
                  value,
                  { fromYears: 0, toYears: 120 },
                  baseMonth
                )
              }
              onPetToggle={handlePetToggle}
              onPetMonthlyCostChange={(value) => {
                const petId = buildOnboardingMemberId(scenario.id, "pet");
                upsertBudgetRuleForCategory(
                  "petcare",
                  petId,
                  value,
                  { fromYears: 0, toYears: 40 },
                  baseMonth
                );
              }}
            />
          )}

          {step === 5 && (
            <StepDecisions
              showHome={persona !== "A"}
              showInvestment={persona !== "A"}
              homeEnabled={Boolean(homePosition)}
              homePurchaseMonth={homePosition?.purchaseMonth ?? baseMonth}
              homePurchasePrice={homePosition?.purchasePrice ?? 0}
              homeDownPaymentPct={
                homePosition?.purchasePrice
                  ? Math.round(
                      ((homePosition.downPayment ?? 0) / homePosition.purchasePrice) * 100
                    )
                  : 0
              }
              homeTermYears={homePosition?.mortgageTermYears ?? 30}
              homeRatePct={homePosition?.mortgageRatePct ?? 4}
              homeFees={homePosition?.feesOneTime ?? 0}
              homeHoldingCostMonthly={homePosition?.holdingCostMonthly ?? 0}
              homeAppreciationPct={homePosition?.annualAppreciationPct ?? 3}
              investmentEnabled={Boolean(investmentPosition)}
              investmentMonthly={investmentPosition?.monthlyContribution ?? 0}
              investmentReturnPct={investmentPosition?.expectedAnnualReturnPct ?? 5}
              investmentFeePct={investmentPosition?.feeAnnualRatePct}
              investmentStartMonth={investmentPosition?.startMonth ?? baseMonth}
              loanEnabled={Boolean(loanPosition)}
              loanStartMonth={loanPosition?.startMonth ?? baseMonth}
              loanPrincipal={loanPosition?.principal ?? 0}
              loanRatePct={loanPosition?.annualInterestRatePct ?? 4}
              loanTermYears={loanPosition?.termYears ?? 5}
              loanMonthlyPayment={loanPosition?.monthlyPayment}
              errors={errors}
              onHomeToggle={handleHomeToggle}
              onHomeChange={(patch) => {
                if (!homePosition) {
                  return;
                }
                const purchasePrice = patch.homePurchasePrice ?? homePosition.purchasePrice ?? 0;
                const downPaymentPct =
                  patch.homeDownPaymentPct ??
                  (purchasePrice
                    ? Math.round(((homePosition.downPayment ?? 0) / purchasePrice) * 100)
                    : 0);
                const downPayment = (purchasePrice * downPaymentPct) / 100;
                updateHomePosition(scenario.id, {
                  ...homePosition,
                  purchaseMonth: patch.homePurchaseMonth ?? homePosition.purchaseMonth,
                  purchasePrice,
                  downPayment,
                  mortgageTermYears: patch.homeTermYears ?? homePosition.mortgageTermYears,
                  mortgageRatePct: patch.homeRatePct ?? homePosition.mortgageRatePct,
                  feesOneTime: patch.homeFees ?? homePosition.feesOneTime,
                  holdingCostMonthly:
                    patch.homeHoldingCostMonthly ?? homePosition.holdingCostMonthly,
                  holdingCostAnnualGrowthPct: homePosition.holdingCostAnnualGrowthPct ?? 0,
                  annualAppreciationPct:
                    patch.homeAppreciationPct ?? homePosition.annualAppreciationPct,
                });
              }}
              onInvestmentToggle={handleInvestmentToggle}
              onInvestmentChange={(patch) => {
                if (!investmentPosition) {
                  return;
                }
                updateInvestmentPosition(scenario.id, {
                  ...investmentPosition,
                  startMonth: patch.investmentStartMonth ?? investmentPosition.startMonth,
                  monthlyContribution:
                    patch.investmentMonthly ?? investmentPosition.monthlyContribution,
                  expectedAnnualReturnPct:
                    patch.investmentReturnPct ?? investmentPosition.expectedAnnualReturnPct,
                  feeAnnualRatePct:
                    patch.investmentFeePct ?? investmentPosition.feeAnnualRatePct,
                });
              }}
              onLoanToggle={handleLoanToggle}
              onLoanChange={(patch) => {
                if (!loanPosition) {
                  return;
                }
                updateLoanPosition(scenario.id, {
                  ...loanPosition,
                  startMonth: patch.loanStartMonth ?? loanPosition.startMonth,
                  principal: patch.loanPrincipal ?? loanPosition.principal,
                  annualInterestRatePct: patch.loanRatePct ?? loanPosition.annualInterestRatePct,
                  termYears: patch.loanTermYears ?? loanPosition.termYears,
                  monthlyPayment: patch.loanMonthlyPayment ?? loanPosition.monthlyPayment,
                });
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
