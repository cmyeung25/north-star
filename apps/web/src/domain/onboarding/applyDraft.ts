import type { EventDefinition } from "../events/types";
import type {
  BudgetCategory,
  BudgetRule,
  CarPosition,
  HomePositionDraft,
  InvestmentPosition,
  LoanPosition,
  Scenario,
  ScenarioMember,
} from "../../store/scenarioStore";
import type { ApplyScope } from "../applyScope";
import { normalizeOnboardingMonth } from "../../utils/month";
import { getCurrentMonth } from "../../features/onboarding/utils";

export type OnboardingMemberDraft = {
  id: string;
  name: string;
  kind: "person" | "pet";
  birthMonth?: string;
  ageAtBaseMonth?: number;
};

export type OnboardingBudgetRuleDraft = {
  id: string;
  name: string;
  enabled: boolean;
  memberId?: string | null;
  category: BudgetCategory;
  ageBand?: { fromYears: number; toYears: number } | null;
  monthlyAmount: number;
  annualGrowthPct?: number;
  startMonth?: string | null;
  endMonth?: string | null;
};

export type OnboardingIncomeDraft = {
  id: string;
  title: string;
  memberId: string | "household" | null;
  subtype: "salary" | "bonus" | "freelance" | "rental" | "dividend" | "interest" | "other";
  monthlyAmount: number;
  startMonth?: string | null;
  endMonth?: string | null;
  endAtAgeYears?: number | null;
  annualGrowthPct?: number;
};

export type OnboardingTimelineEventDraft = {
  id: string;
  title: string;
  type: EventDefinition["type"];
  memberId: string | "household" | null;
  startMonth?: string | null;
  endMonth?: string | null;
  monthlyAmount?: number;
  oneTimeAmount?: number;
  annualGrowthPct?: number;
};

export type OnboardingPositionsDraft = {
  homes: HomePositionDraft[];
  cars: CarPosition[];
  investments: InvestmentPosition[];
  loans: LoanPosition[];
};

export type OnboardingSettingsDraft = {
  baseMonth: string;
  horizonMonths: number;
  annualInflationPct: number;
  viewMode: "nominal" | "real";
};

export type OnboardingDraft = {
  members: OnboardingMemberDraft[];
  settings: OnboardingSettingsDraft;
  budgetRules: OnboardingBudgetRuleDraft[];
  positions: OnboardingPositionsDraft;
  incomes: OnboardingIncomeDraft[];
  timelineEvents: OnboardingTimelineEventDraft[];
};

export type OnboardingApplyActions = {
  members: ScenarioMember[];
  budgetRules: BudgetRule[];
  updateScenarioAssumptions: (
    id: string,
    patch: Partial<Scenario["assumptions"]>
  ) => void;
  setGlobalHorizonMonths: (horizonMonths: number) => void;
  setGlobalBaseMonth: (baseMonth: string | null) => void;
  setAnnualInflationPct: (value: number) => void;
  setViewMode: (value: "nominal" | "real") => void;
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
  addHomePosition: (id: string, home: HomePositionDraft) => void;
  updateHomePosition: (id: string, home: HomePositionDraft) => void;
  addInvestmentPosition: (id: string, investment: InvestmentPosition) => void;
  updateInvestmentPosition: (id: string, investment: InvestmentPosition) => void;
  addLoanPosition: (id: string, loan: LoanPosition) => void;
  updateLoanPosition: (id: string, loan: LoanPosition) => void;
  createMember: (member: ScenarioMember) => void;
  updateMember: (memberId: string, patch: Partial<ScenarioMember>) => void;
  deleteMember: (memberId: string) => void;
  createBudgetRule: (rule: BudgetRule) => void;
  updateBudgetRule: (ruleId: string, patch: Partial<BudgetRule>) => void;
  removeBudgetRule: (ruleId: string) => void;
};

const defaultApplyScope: ApplyScope = { scope: "all" };
const DEFAULT_MEMBER_NAME = "主要成員";

const isDefaultSeedMember = (member: ScenarioMember) =>
  member.name.trim() === DEFAULT_MEMBER_NAME &&
  member.kind === "person" &&
  (member.applyScope?.scope ?? "all") === "all" &&
  (member.milestones?.length ?? 0) === 0 &&
  !member.birthMonth &&
  member.ageAtBaseMonth === undefined;

const upsertMember = (
  actions: OnboardingApplyActions,
  member: ScenarioMember
) => {
  const existing = actions.members.find((entry) => entry.id === member.id);
  if (existing) {
    actions.updateMember(member.id, {
      ...member,
      applyScope: existing.applyScope ?? defaultApplyScope,
    });
    return;
  }
  actions.createMember({ ...member, applyScope: defaultApplyScope });
};

const upsertBudgetRule = (
  actions: OnboardingApplyActions,
  payload: BudgetRule
) => {
  const existing = actions.budgetRules.find((rule) => rule.id === payload.id);
  if (existing) {
    actions.updateBudgetRule(payload.id, payload);
  } else {
    actions.createBudgetRule(payload);
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

export const applyOnboardingDraftToScenario = (
  scenario: Scenario,
  draft: OnboardingDraft,
  actions: OnboardingApplyActions
) => {
  const { settings } = draft;
  const baseMonth = settings.baseMonth || getCurrentMonth();

  actions.setGlobalBaseMonth(baseMonth);
  actions.setGlobalHorizonMonths(settings.horizonMonths);
  actions.setAnnualInflationPct(settings.annualInflationPct);
  actions.setViewMode(settings.viewMode);

  actions.updateScenarioAssumptions(scenario.id, {
    baseMonth,
    horizonMonths: settings.horizonMonths,
    includeBudgetRulesInProjection: true,
  });

  const shouldReplaceDefaultMember =
    !scenario.clientComputed?.onboardingCompleted &&
    actions.members.length === 1 &&
    isDefaultSeedMember(actions.members[0]) &&
    draft.members.length > 0;

  const memberIdMap = new Map<string, string>();
  const normalizedMembers = shouldReplaceDefaultMember
    ? (() => {
        const [defaultMember] = actions.members;
        const [primaryDraft, ...rest] = draft.members;
        memberIdMap.set(primaryDraft.id, defaultMember.id);
        return [{ ...primaryDraft, id: defaultMember.id }, ...rest];
      })()
    : draft.members;

  const resolveMemberId = (memberId: string | "household" | null | undefined) => {
    if (!memberId || memberId === "household") {
      return memberId ?? undefined;
    }
    return memberIdMap.get(memberId) ?? memberId;
  };

  normalizedMembers.forEach((member) => {
    upsertMember(actions, {
      id: member.id,
      name: member.name,
      kind: member.kind,
      birthMonth: member.birthMonth,
      ageAtBaseMonth: member.ageAtBaseMonth,
    });
  });

  draft.budgetRules.forEach((rule) => {
    const normalizedStart = normalizeOnboardingMonth(rule.startMonth, baseMonth);
    const normalizedEnd = normalizeOnboardingMonth(rule.endMonth);
    if (!normalizedStart.ok || !normalizedEnd.ok) {
      return;
    }
    const mappedMemberId = resolveMemberId(rule.memberId);

    upsertBudgetRule(actions, {
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      memberId:
        mappedMemberId === "household" ? undefined : (mappedMemberId as string | undefined),
      category: rule.category,
      ageBand: rule.ageBand ?? { fromYears: 0, toYears: 120 },
      monthlyAmount: rule.monthlyAmount,
      annualGrowthPct: rule.annualGrowthPct ?? 0,
      startMonth: normalizedStart.month,
      endMonth: normalizedEnd.month,
      applyScope: defaultApplyScope,
    });
  });

  draft.positions.cars.forEach((car) => {
    const exists = scenario.positions?.cars?.some((entry) => entry.id === car.id);
    if (exists) {
      actions.updateCarPosition(scenario.id, car);
    } else {
      actions.addCarPosition(scenario.id, car);
    }
  });

  draft.positions.homes.forEach((home) => {
    const exists = scenario.positions?.homes?.some((entry) => entry.id === home.id);
    if (exists) {
      actions.updateHomePosition(scenario.id, home);
    } else {
      actions.addHomePosition(scenario.id, home);
    }
  });

  draft.positions.investments.forEach((investment) => {
    const exists = scenario.positions?.investments?.some(
      (entry) => entry.id === investment.id
    );
    if (exists) {
      actions.updateInvestmentPosition(scenario.id, investment);
    } else {
      actions.addInvestmentPosition(scenario.id, investment);
    }
  });

  draft.positions.loans.forEach((loan) => {
    const exists = scenario.positions?.loans?.some((entry) => entry.id === loan.id);
    if (exists) {
      actions.updateLoanPosition(scenario.id, loan);
    } else {
      actions.addLoanPosition(scenario.id, loan);
    }
  });

  draft.incomes.forEach((income) => {
    const normalizedStart = normalizeOnboardingMonth(income.startMonth, baseMonth);
    const normalizedEnd = normalizeOnboardingMonth(income.endMonth);
    if (!normalizedStart.ok || !normalizedEnd.ok) {
      return;
    }

    const mappedMemberId = resolveMemberId(income.memberId);
    const definition: EventDefinition = {
      id: income.id,
      title: income.title,
      type: "salary",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: normalizedStart.month,
        endMonth: normalizedEnd.month ?? null,
        monthlyAmount: income.monthlyAmount,
        oneTimeAmount: 0,
        annualGrowthPct: income.annualGrowthPct ?? 0,
      },
      currency: scenario.baseCurrency,
      memberId:
        mappedMemberId === "household" ? undefined : (mappedMemberId as string | undefined),
      incomeSubtype: income.subtype,
      endAtAgeYears: income.endAtAgeYears ?? undefined,
    };

    upsertEvent(scenario, actions, definition);
  });

  draft.timelineEvents.forEach((event) => {
    const normalizedStart = normalizeOnboardingMonth(event.startMonth, baseMonth);
    const normalizedEnd = normalizeOnboardingMonth(event.endMonth);
    if (!normalizedStart.ok || !normalizedEnd.ok) {
      return;
    }

    const mappedMemberId = resolveMemberId(event.memberId);
    const definition: EventDefinition = {
      id: event.id,
      title: event.title,
      type: event.type,
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: normalizedStart.month,
        endMonth: normalizedEnd.month ?? null,
        monthlyAmount: event.monthlyAmount ?? 0,
        oneTimeAmount: event.oneTimeAmount ?? 0,
        annualGrowthPct: event.annualGrowthPct ?? 0,
      },
      currency: scenario.baseCurrency,
      memberId:
        mappedMemberId === "household" ? undefined : (mappedMemberId as string | undefined),
    };

    upsertEvent(scenario, actions, definition);
  });

};

export const buildDefaultOnboardingDraft = (
  scenario: Scenario,
  baseMonth: string
): OnboardingDraft => ({
  members: [],
  settings: {
    baseMonth,
    horizonMonths: scenario.assumptions.horizonMonths ?? 360,
    annualInflationPct: 0,
    viewMode: "nominal",
  },
  budgetRules: [],
  positions: {
    homes: [],
    cars: [],
    investments: [],
    loans: [],
  },
  incomes: [],
  timelineEvents: [],
});
