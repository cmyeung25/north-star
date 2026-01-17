import type { EventDefinition } from "../events/types";
import { addMonths } from "../members/age";
import {
  buildOnboardingBudgetRuleId,
  buildOnboardingEventId,
  buildOnboardingMemberId,
  buildOnboardingPositionId,
  computeDurationYears,
  computeEndMonthFromDuration,
} from "../../features/onboarding/utils";
import { isValidMonthStr } from "../../utils/month";
import type {
  BudgetRule,
  CarPosition,
  HomePositionDraft,
  InvestmentPosition,
  LoanPosition,
  OnboardingPersona,
  Scenario,
  ScenarioMember,
} from "../../store/scenarioStore";

export type OnboardingDraft = {
  persona?: OnboardingPersona;
  basics: {
    baseMonth: string;
    initialCash: number;
    horizonMonths: number;
  };
  income: {
    monthlyAmount: number;
    annualGrowthPct: number;
    retirementMonth: string | null;
  };
  lifestyle: {
    rentEnabled: boolean;
    rentMonthly: number;
    rentStartMonth: string;
    rentDurationYears?: number;
    carEnabled: boolean;
    car: {
      purchaseMonth: string;
      purchasePrice: number;
      downPayment: number;
      loanTermYears: number;
      loanRatePct: number;
      holdingCostMonthly: number;
      depreciationPct: number;
    };
    travelEnabled: boolean;
    travelAnnualBudget: number;
  };
  family: {
    partnerEnabled: boolean;
    partnerName: string;
    childEnabled: boolean;
    childBirthMonth: string;
    childcareStartAge: number;
    educationStartAge: number;
    childcareLevel: "low" | "mid" | "high";
    educationLevel: "low" | "mid" | "high";
    parentEnabled: boolean;
    parentMonthlyCost: number;
    petEnabled: boolean;
    petMonthlyCost: number;
  };
  decisions: {
    homeEnabled: boolean;
    home: {
      purchaseMonth: string;
      purchasePrice: number;
      downPaymentPct: number;
      mortgageTermYears: number;
      mortgageRatePct: number;
      feesOneTime: number;
      holdingCostMonthly: number;
      appreciationPct: number;
    };
    investmentEnabled: boolean;
    investment: {
      monthlyContribution: number;
      expectedAnnualReturnPct: number;
      feeAnnualRatePct?: number;
      startMonth: string;
    };
    loanEnabled: boolean;
    loan: {
      startMonth: string;
      principal: number;
      annualInterestRatePct: number;
      termYears: number;
      monthlyPayment?: number;
    };
  };
};

export type OnboardingApplyActions = {
  updateScenarioAssumptions: (
    id: string,
    patch: Partial<Scenario["assumptions"]>
  ) => void;
  updateScenarioClientComputed: (
    id: string,
    patch: Partial<NonNullable<Scenario["clientComputed"]>>
  ) => void;
  upsertEventDefinition: (definition: EventDefinition) => void;
  upsertScenarioEventRef: (id: string, ref: { refId: string; enabled: boolean }) => void;
  removeScenarioEventRef: (id: string, refId: string) => void;
  removeEventDefinition: (id: string) => void;
  addCarPosition: (id: string, car: CarPosition) => void;
  updateCarPosition: (id: string, car: CarPosition) => void;
  removeCarPosition: (id: string, carId: string) => void;
  addHomePosition: (id: string, home: HomePositionDraft) => void;
  updateHomePosition: (id: string, home: HomePositionDraft) => void;
  removeHomePosition: (id: string, homeId: string) => void;
  addInvestmentPosition: (id: string, investment: InvestmentPosition) => void;
  updateInvestmentPosition: (id: string, investment: InvestmentPosition) => void;
  removeInvestmentPosition: (id: string, investmentId: string) => void;
  addLoanPosition: (id: string, loan: LoanPosition) => void;
  updateLoanPosition: (id: string, loan: LoanPosition) => void;
  removeLoanPosition: (id: string, loanId: string) => void;
  upsertScenarioMember: (id: string, member: ScenarioMember) => void;
  removeScenarioMember: (id: string, memberId: string) => void;
  addBudgetRule: (id: string, rule: BudgetRule) => void;
  updateBudgetRule: (id: string, ruleId: string, patch: Partial<BudgetRule>) => void;
  removeBudgetRule: (id: string, ruleId: string) => void;
};

const childcarePreset = { low: 3000, mid: 6000, high: 9000 };
const educationPreset = { low: 2000, mid: 4500, high: 8000 };

const upsertBudgetRule = (
  scenario: Scenario,
  actions: OnboardingApplyActions,
  payload: BudgetRule
) => {
  const existing = scenario.budgetRules?.find((rule) => rule.id === payload.id);
  if (existing) {
    actions.updateBudgetRule(scenario.id, payload.id, payload);
  } else {
    actions.addBudgetRule(scenario.id, payload);
  }
};

const removeBudgetRuleById = (
  scenario: Scenario,
  actions: OnboardingApplyActions,
  ruleId: string
) => {
  if (scenario.budgetRules?.some((rule) => rule.id === ruleId)) {
    actions.removeBudgetRule(scenario.id, ruleId);
  }
};

const upsertEvent = (
  scenario: Scenario,
  actions: OnboardingApplyActions,
  definition: EventDefinition
) => {
  actions.upsertEventDefinition(definition);
  actions.upsertScenarioEventRef(scenario.id, { refId: definition.id, enabled: true });
};

const removeEvent = (
  scenario: Scenario,
  actions: OnboardingApplyActions,
  eventId: string
) => {
  if (scenario.eventRefs?.some((ref) => ref.refId === eventId)) {
    actions.removeScenarioEventRef(scenario.id, eventId);
  }
  actions.removeEventDefinition(eventId);
};

const removePositionById = (
  scenario: Scenario,
  positionId: string,
  actions: Pick<
    OnboardingApplyActions,
    "removeCarPosition" | "removeHomePosition" | "removeInvestmentPosition" | "removeLoanPosition"
  >
) => {
  scenario.positions?.cars
    ?.filter((car) => car.id === positionId)
    .forEach((car) => actions.removeCarPosition(scenario.id, car.id ?? ""));
  scenario.positions?.homes
    ?.filter((home) => home.id === positionId)
    .forEach((home) => actions.removeHomePosition(scenario.id, home.id));
  scenario.positions?.investments
    ?.filter((investment) => investment.id === positionId)
    .forEach((investment) =>
      actions.removeInvestmentPosition(scenario.id, investment.id ?? "")
    );
  scenario.positions?.loans
    ?.filter((loan) => loan.id === positionId)
    .forEach((loan) => actions.removeLoanPosition(scenario.id, loan.id ?? ""));
};

export const applyOnboardingDraftToScenario = (
  scenario: Scenario,
  draft: OnboardingDraft,
  actions: OnboardingApplyActions
) => {
  const baseMonth = draft.basics.baseMonth;

  actions.updateScenarioAssumptions(scenario.id, {
    baseMonth,
    initialCash: draft.basics.initialCash,
    horizonMonths: draft.basics.horizonMonths,
    includeBudgetRulesInProjection: true,
  });

  if (draft.persona) {
    actions.updateScenarioClientComputed(scenario.id, {
      onboardingPersona: draft.persona,
    });
  }

  if (draft.income.monthlyAmount > 0) {
    const incomeEventId = buildOnboardingEventId(scenario.id, "income");
    const incomeDefinition: EventDefinition = {
      id: incomeEventId,
      title: "Onboarding Income",
      type: "salary",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: baseMonth,
        endMonth: draft.income.retirementMonth || null,
        monthlyAmount: draft.income.monthlyAmount,
        oneTimeAmount: 0,
        annualGrowthPct: draft.income.annualGrowthPct,
      },
      currency: scenario.baseCurrency,
    };

    upsertEvent(scenario, actions, incomeDefinition);
  }

  const rentEventId = buildOnboardingEventId(scenario.id, "rent");
  if (draft.lifestyle.rentEnabled) {
    const rentDefinition: EventDefinition = {
      id: rentEventId,
      title: "Onboarding Rent",
      type: "rent",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: draft.lifestyle.rentStartMonth,
        endMonth: computeEndMonthFromDuration(
          draft.lifestyle.rentStartMonth,
          draft.lifestyle.rentDurationYears
        ),
        monthlyAmount: draft.lifestyle.rentMonthly,
        oneTimeAmount: 0,
        annualGrowthPct: 0,
      },
      currency: scenario.baseCurrency,
    };

    upsertEvent(scenario, actions, rentDefinition);
  } else {
    removeEvent(scenario, actions, rentEventId);
  }

  const travelEventId = buildOnboardingEventId(scenario.id, "travel");
  if (draft.lifestyle.travelEnabled) {
    const travelDefinition: EventDefinition = {
      id: travelEventId,
      title: "Onboarding Travel",
      type: "travel",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: baseMonth,
        endMonth: null,
        monthlyAmount: draft.lifestyle.travelAnnualBudget / 12,
        oneTimeAmount: 0,
        annualGrowthPct: 0,
      },
      currency: scenario.baseCurrency,
    };

    upsertEvent(scenario, actions, travelDefinition);
  } else {
    removeEvent(scenario, actions, travelEventId);
  }

  const carId = buildOnboardingPositionId(scenario.id, "car");
  if (draft.lifestyle.carEnabled) {
    const carPosition: CarPosition = {
      id: carId,
      purchaseMonth: draft.lifestyle.car.purchaseMonth,
      purchasePrice: draft.lifestyle.car.purchasePrice,
      downPayment: draft.lifestyle.car.downPayment,
      annualDepreciationRatePct: draft.lifestyle.car.depreciationPct,
      holdingCostMonthly: draft.lifestyle.car.holdingCostMonthly,
      holdingCostAnnualGrowthPct: 0,
      loan: {
        principal: Math.max(
          0,
          draft.lifestyle.car.purchasePrice - draft.lifestyle.car.downPayment
        ),
        annualInterestRatePct: draft.lifestyle.car.loanRatePct,
        termYears: draft.lifestyle.car.loanTermYears,
      },
    };

    if (scenario.positions?.cars?.some((car) => car.id === carId)) {
      actions.updateCarPosition(scenario.id, carPosition);
    } else {
      actions.addCarPosition(scenario.id, carPosition);
    }
  } else {
    removePositionById(scenario, carId, actions);
  }

  const partnerId = buildOnboardingMemberId(scenario.id, "partner");
  if (draft.family.partnerEnabled) {
    actions.upsertScenarioMember(scenario.id, {
      id: partnerId,
      name: draft.family.partnerName || "伴侶",
      kind: "person",
    });
  } else {
    actions.removeScenarioMember(scenario.id, partnerId);
  }

  const childId = buildOnboardingMemberId(scenario.id, "child");
  if (draft.family.childEnabled && isValidMonthStr(draft.family.childBirthMonth)) {
    const birthMonth = draft.family.childBirthMonth;
    actions.upsertScenarioMember(scenario.id, {
      id: childId,
      name: "小朋友",
      kind: "person",
      birthMonth,
    });

    const childcareStartMonth = addMonths(
      birthMonth,
      Math.round(draft.family.childcareStartAge * 12)
    );
    const childcareEndMonth = addMonths(birthMonth, 6 * 12);
    const educationStartMonth = addMonths(
      birthMonth,
      Math.round(draft.family.educationStartAge * 12)
    );
    const educationEndMonth = addMonths(birthMonth, 18 * 12);

    upsertBudgetRule(scenario, actions, {
      id: buildOnboardingBudgetRuleId(scenario.id, "childcare", childId),
      name: "childcare",
      enabled: true,
      memberId: childId,
      category: "childcare",
      ageBand: { fromYears: draft.family.childcareStartAge, toYears: 6 },
      monthlyAmount: childcarePreset[draft.family.childcareLevel],
      startMonth: childcareStartMonth,
      endMonth: childcareEndMonth,
    });

    upsertBudgetRule(scenario, actions, {
      id: buildOnboardingBudgetRuleId(scenario.id, "education", childId),
      name: "education",
      enabled: true,
      memberId: childId,
      category: "education",
      ageBand: { fromYears: draft.family.educationStartAge, toYears: 18 },
      monthlyAmount: educationPreset[draft.family.educationLevel],
      startMonth: educationStartMonth,
      endMonth: educationEndMonth,
    });
  } else {
    actions.removeScenarioMember(scenario.id, childId);
    removeBudgetRuleById(
      scenario,
      actions,
      buildOnboardingBudgetRuleId(scenario.id, "childcare", childId)
    );
    removeBudgetRuleById(
      scenario,
      actions,
      buildOnboardingBudgetRuleId(scenario.id, "education", childId)
    );
  }

  if (draft.family.parentEnabled) {
    upsertBudgetRule(scenario, actions, {
      id: buildOnboardingBudgetRuleId(scenario.id, "eldercare"),
      name: "eldercare",
      enabled: true,
      category: "eldercare",
      ageBand: { fromYears: 0, toYears: 120 },
      monthlyAmount: draft.family.parentMonthlyCost,
      startMonth: baseMonth,
      endMonth: undefined,
    });
  } else {
    removeBudgetRuleById(
      scenario,
      actions,
      buildOnboardingBudgetRuleId(scenario.id, "eldercare")
    );
  }

  const petId = buildOnboardingMemberId(scenario.id, "pet");
  if (draft.family.petEnabled) {
    actions.upsertScenarioMember(scenario.id, {
      id: petId,
      name: "寵物",
      kind: "pet",
    });

    upsertBudgetRule(scenario, actions, {
      id: buildOnboardingBudgetRuleId(scenario.id, "petcare", petId),
      name: "petcare",
      enabled: true,
      memberId: petId,
      category: "petcare",
      ageBand: { fromYears: 0, toYears: 40 },
      monthlyAmount: draft.family.petMonthlyCost,
      startMonth: baseMonth,
      endMonth: undefined,
    });
  } else {
    actions.removeScenarioMember(scenario.id, petId);
    removeBudgetRuleById(
      scenario,
      actions,
      buildOnboardingBudgetRuleId(scenario.id, "petcare", petId)
    );
  }

  const homeId = buildOnboardingPositionId(scenario.id, "home");
  if (draft.decisions.homeEnabled) {
    const downPayment =
      (draft.decisions.home.purchasePrice * draft.decisions.home.downPaymentPct) / 100;
    const homePosition: HomePositionDraft = {
      id: homeId,
      purchaseMonth: draft.decisions.home.purchaseMonth,
      purchasePrice: draft.decisions.home.purchasePrice,
      downPayment,
      annualAppreciationPct: draft.decisions.home.appreciationPct,
      mortgageRatePct: draft.decisions.home.mortgageRatePct,
      mortgageTermYears: draft.decisions.home.mortgageTermYears,
      feesOneTime: draft.decisions.home.feesOneTime,
      holdingCostMonthly: draft.decisions.home.holdingCostMonthly,
      holdingCostAnnualGrowthPct: 0,
    };

    if (scenario.positions?.homes?.some((home) => home.id === homeId)) {
      actions.updateHomePosition(scenario.id, homePosition);
    } else {
      actions.addHomePosition(scenario.id, homePosition);
    }
  } else {
    removePositionById(scenario, homeId, actions);
  }

  const investmentId = buildOnboardingPositionId(scenario.id, "investment");
  if (draft.decisions.investmentEnabled) {
    const investmentPosition: InvestmentPosition = {
      id: investmentId,
      assetClass: "fund",
      startMonth: draft.decisions.investment.startMonth,
      initialValue: 0,
      expectedAnnualReturnPct: draft.decisions.investment.expectedAnnualReturnPct,
      monthlyContribution: draft.decisions.investment.monthlyContribution,
      feeAnnualRatePct: draft.decisions.investment.feeAnnualRatePct,
    };

    if (scenario.positions?.investments?.some((investment) => investment.id === investmentId)) {
      actions.updateInvestmentPosition(scenario.id, investmentPosition);
    } else {
      actions.addInvestmentPosition(scenario.id, investmentPosition);
    }
  } else {
    removePositionById(scenario, investmentId, actions);
  }

  const loanId = buildOnboardingPositionId(scenario.id, "loan");
  if (draft.decisions.loanEnabled) {
    const loanPosition: LoanPosition = {
      id: loanId,
      startMonth: draft.decisions.loan.startMonth,
      principal: draft.decisions.loan.principal,
      annualInterestRatePct: draft.decisions.loan.annualInterestRatePct,
      termYears: draft.decisions.loan.termYears,
      monthlyPayment: draft.decisions.loan.monthlyPayment,
    };

    if (scenario.positions?.loans?.some((loan) => loan.id === loanId)) {
      actions.updateLoanPosition(scenario.id, loanPosition);
    } else {
      actions.addLoanPosition(scenario.id, loanPosition);
    }
  } else {
    removePositionById(scenario, loanId, actions);
  }
};

export const buildDefaultOnboardingDraft = (
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  baseMonth: string
): OnboardingDraft => {
  const rentEventId = buildOnboardingEventId(scenario.id, "rent");
  const travelEventId = buildOnboardingEventId(scenario.id, "travel");
  const incomeEventId = buildOnboardingEventId(scenario.id, "income");

  const incomeEvent = eventLibrary.find((event) => event.id === incomeEventId);
  const rentEvent = eventLibrary.find((event) => event.id === rentEventId);
  const travelEvent = eventLibrary.find((event) => event.id === travelEventId);

  const rentRef = scenario.eventRefs?.find((ref) => ref.refId === rentEventId);
  const travelRef = scenario.eventRefs?.find((ref) => ref.refId === travelEventId);

  const carId = buildOnboardingPositionId(scenario.id, "car");
  const homeId = buildOnboardingPositionId(scenario.id, "home");
  const investmentId = buildOnboardingPositionId(scenario.id, "investment");
  const loanId = buildOnboardingPositionId(scenario.id, "loan");

  const car = scenario.positions?.cars?.find((item) => item.id === carId);
  const home = scenario.positions?.homes?.find((item) => item.id === homeId);
  const investment = scenario.positions?.investments?.find(
    (item) => item.id === investmentId
  );
  const loan = scenario.positions?.loans?.find((item) => item.id === loanId);

  const partnerId = buildOnboardingMemberId(scenario.id, "partner");
  const childId = buildOnboardingMemberId(scenario.id, "child");
  const petId = buildOnboardingMemberId(scenario.id, "pet");

  const partner = scenario.members?.find((member) => member.id === partnerId);
  const child = scenario.members?.find((member) => member.id === childId);

  const childcareRule = scenario.budgetRules?.find(
    (rule) => rule.id === buildOnboardingBudgetRuleId(scenario.id, "childcare", childId)
  );
  const educationRule = scenario.budgetRules?.find(
    (rule) => rule.id === buildOnboardingBudgetRuleId(scenario.id, "education", childId)
  );

  const parentRule = scenario.budgetRules?.find(
    (rule) => rule.id === buildOnboardingBudgetRuleId(scenario.id, "eldercare")
  );

  const petRule = scenario.budgetRules?.find(
    (rule) => rule.id === buildOnboardingBudgetRuleId(scenario.id, "petcare", petId)
  );

  const resolvePresetLevel = (
    value: number,
    presets: Record<"low" | "mid" | "high", number>
  ) => {
    if (value === presets.low) {
      return "low";
    }
    if (value === presets.high) {
      return "high";
    }
    return "mid";
  };

  const rentStartMonth = rentEvent?.rule.startMonth ?? baseMonth;

  return {
    persona: scenario.clientComputed?.onboardingPersona,
    basics: {
      baseMonth,
      initialCash: scenario.assumptions.initialCash ?? 0,
      horizonMonths: scenario.assumptions.horizonMonths ?? 240,
    },
    income: {
      monthlyAmount: Number(incomeEvent?.rule.monthlyAmount ?? 0),
      annualGrowthPct: incomeEvent?.rule.annualGrowthPct ?? 0,
      retirementMonth: incomeEvent?.rule.endMonth ?? null,
    },
    lifestyle: {
      rentEnabled: Boolean(rentRef?.enabled),
      rentMonthly: Number(rentEvent?.rule.monthlyAmount ?? 0),
      rentStartMonth,
      rentDurationYears:
        rentEvent?.rule.startMonth && rentEvent.rule.endMonth
          ? computeDurationYears(rentEvent.rule.startMonth, rentEvent.rule.endMonth)
          : undefined,
      carEnabled: Boolean(car),
      car: {
        purchaseMonth: car?.purchaseMonth ?? baseMonth,
        purchasePrice: car?.purchasePrice ?? 0,
        downPayment: car?.downPayment ?? 0,
        loanTermYears: car?.loan?.termYears ?? 5,
        loanRatePct: car?.loan?.annualInterestRatePct ?? 4,
        holdingCostMonthly: car?.holdingCostMonthly ?? 0,
        depreciationPct: car?.annualDepreciationRatePct ?? 12,
      },
      travelEnabled: Boolean(travelRef?.enabled),
      travelAnnualBudget: Number(travelEvent?.rule.monthlyAmount ?? 0) * 12,
    },
    family: {
      partnerEnabled: Boolean(partner),
      partnerName: partner?.name ?? "",
      childEnabled: Boolean(child),
      childBirthMonth: child?.birthMonth ?? "",
      childcareStartAge: childcareRule?.ageBand.fromYears ?? 0,
      educationStartAge: educationRule?.ageBand.fromYears ?? 6,
      childcareLevel: resolvePresetLevel(
        childcareRule?.monthlyAmount ?? childcarePreset.mid,
        childcarePreset
      ),
      educationLevel: resolvePresetLevel(
        educationRule?.monthlyAmount ?? educationPreset.mid,
        educationPreset
      ),
      parentEnabled: Boolean(parentRule),
      parentMonthlyCost: parentRule?.monthlyAmount ?? 0,
      petEnabled: Boolean(petRule),
      petMonthlyCost: petRule?.monthlyAmount ?? 0,
    },
    decisions: {
      homeEnabled: Boolean(home),
      home: {
        purchaseMonth: home?.purchaseMonth ?? baseMonth,
        purchasePrice: home?.purchasePrice ?? 0,
        downPaymentPct:
          home?.purchasePrice && home.purchasePrice > 0
            ? Math.round(((home.downPayment ?? 0) / home.purchasePrice) * 100)
            : 0,
        mortgageTermYears: home?.mortgageTermYears ?? 30,
        mortgageRatePct: home?.mortgageRatePct ?? 4,
        feesOneTime: home?.feesOneTime ?? 0,
        holdingCostMonthly: home?.holdingCostMonthly ?? 0,
        appreciationPct: home?.annualAppreciationPct ?? 3,
      },
      investmentEnabled: Boolean(investment),
      investment: {
        monthlyContribution: investment?.monthlyContribution ?? 0,
        expectedAnnualReturnPct: investment?.expectedAnnualReturnPct ?? 5,
        feeAnnualRatePct: investment?.feeAnnualRatePct,
        startMonth: investment?.startMonth ?? baseMonth,
      },
      loanEnabled: Boolean(loan),
      loan: {
        startMonth: loan?.startMonth ?? baseMonth,
        principal: loan?.principal ?? 0,
        annualInterestRatePct: loan?.annualInterestRatePct ?? 4,
        termYears: loan?.termYears ?? 5,
        monthlyPayment: loan?.monthlyPayment,
      },
    },
  };
};
