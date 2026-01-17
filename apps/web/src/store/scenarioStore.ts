// Shape note: Scenario positions.homes entries originally held price/downPayment/purchaseMonth/annualAppreciationPct/mortgage info (+feesOneTime).
// Added fields: holdingCostMonthly and holdingCostAnnualGrowthPct (percent for UI storage).
// Back-compat: missing holding cost fields default to 0 in adapters/engine.
import { nanoid } from "nanoid";
import { create } from "zustand";
import { defaultCurrency } from "../../lib/i18n";
import type { EventDefinition, ScenarioEventRef } from "../domain/events/types";
import {
  buildEventRuleOverrides,
  type DuplicateCluster,
} from "../domain/events/mergeDuplicates";
import { buildEventLibraryMap, resolveEventRule } from "../domain/events/utils";
import { isValidMonthStr } from "../utils/month";

export type { EventType, TimelineEvent } from "../features/timeline/schema";

export type ScenarioRiskLevel = "Low" | "Medium" | "High";

export type OnboardingPersona = "A" | "B" | "C" | "D" | "E";

export type ScenarioKpis = {
  lowestMonthlyBalance: number;
  runwayMonths: number;
  netWorthYear5: number;
  riskLevel: ScenarioRiskLevel;
};

export type ScenarioAssumptions = {
  horizonMonths: number;
  initialCash: number;
  baseMonth: string | null;
  includeBudgetRulesInProjection?: boolean;
  inflationRate?: number;
  salaryGrowthRate?: number;
  emergencyFundMonths?: number;
  mortgageRatePct?: number;
  mortgageTermYears?: number;
  rentMonthly?: number;
  rentAnnualGrowthPct?: number;
  investmentReturnAssumptions?: Partial<Record<InvestmentAssetClass, number>>;
};

export type HomeUsage = "primary" | "investment";
export type HomeMode = "new_purchase" | "existing";

export type InvestmentAssetClass = "equity" | "bond" | "fund" | "crypto";

export type InsuranceType = "life" | "savings" | "accident" | "medical";

export type InsurancePremiumMode = "monthly" | "annual";

export type ScenarioMemberKind = "person" | "pet";

export type ScenarioMember = {
  id: string;
  name: string;
  kind: ScenarioMemberKind;
  birthMonth?: string;
  ageAtBaseMonth?: number;
};

export type BudgetCategory =
  | "health"
  | "childcare"
  | "education"
  | "eldercare"
  | "petcare";

export type BudgetRule = {
  id: string;
  name: string;
  enabled: boolean;
  memberId?: string;
  category: BudgetCategory;
  ageBand: {
    fromYears: number;
    toYears: number;
  };
  monthlyAmount: number;
  annualGrowthPct?: number;
  startMonth?: string;
  endMonth?: string;
};

export type ExistingHomeDetails = {
  asOfMonth: string;
  marketValue: number;
  mortgageBalance: number;
  remainingTermMonths: number;
  annualRatePct: number;
};

export type RentalDetails = {
  rentMonthly: number;
  rentStartMonth: string;
  rentEndMonth?: string | null;
  rentAnnualGrowthPct?: number;
  vacancyRatePct?: number;
};

export type HomePosition = {
  usage?: HomeUsage;
  mode?: HomeMode;
  purchasePrice?: number;
  downPayment?: number;
  purchaseMonth?: string;
  annualAppreciationPct: number;
  mortgageRatePct?: number;
  mortgageTermYears?: number;
  feesOneTime?: number;
  holdingCostMonthly?: number;
  holdingCostAnnualGrowthPct?: number;
  existing?: ExistingHomeDetails;
  rental?: RentalDetails;
};

export type HomePositionDraft = HomePosition & {
  id: string;
};

export type InvestmentPosition = {
  id?: string;
  assetClass?: InvestmentAssetClass;
  startMonth: string;
  initialValue: number;
  expectedAnnualReturnPct?: number;
  monthlyContribution?: number;
  monthlyWithdrawal?: number;
  feeAnnualRatePct?: number;
};

export type InsurancePosition = {
  id?: string;
  insuranceType: InsuranceType;
  premiumMode: InsurancePremiumMode;
  premiumAmount: number;
  hasCashValue?: boolean;
  cashValueAsOf?: number;
  cashValueAnnualGrowthPct?: number;
  coverageMeta?: Record<string, unknown>;
};

export type LoanPosition = {
  id?: string;
  startMonth: string;
  principal: number;
  annualInterestRatePct: number;
  termYears: number;
  monthlyPayment?: number;
  feesOneTime?: number;
};

export type CarLoanDetails = {
  principal: number;
  annualInterestRatePct: number;
  termYears: number;
  monthlyPayment?: number;
};

export type CarPosition = {
  id?: string;
  purchaseMonth: string;
  purchasePrice: number;
  downPayment: number;
  annualDepreciationRatePct: number;
  holdingCostMonthly: number;
  holdingCostAnnualGrowthPct: number;
  loan?: CarLoanDetails;
};

export type CashBucketPosition = {
  id?: string;
  name?: string;
  balance?: number;
  asOfMonth?: string;
};

export type InvestmentPositionDraft = InvestmentPosition & {
  id: string;
};

export type InsurancePositionDraft = InsurancePosition & {
  id: string;
};

export type LoanPositionDraft = LoanPosition & {
  id: string;
};

export type CarPositionDraft = CarPosition & {
  id: string;
};

export type CashBucketPositionDraft = CashBucketPosition & {
  id: string;
};

export type ScenarioPositions = {
  home?: HomePosition;
  homes?: HomePositionDraft[];
  investments?: InvestmentPositionDraft[];
  insurances?: InsurancePositionDraft[];
  loans?: LoanPositionDraft[];
  cars?: CarPositionDraft[];
  cashBuckets?: CashBucketPositionDraft[];
};

export type ScenarioMeta = {
  onboardingVersion?: number;
};

export type ScenarioClientComputed = {
  onboardingPersona?: OnboardingPersona;
  onboardingCompleted?: boolean;
};

export type Scenario = {
  id: string;
  name: string;
  baseCurrency: string;
  updatedAt: number;
  kpis: ScenarioKpis;
  assumptions: ScenarioAssumptions;
  members?: ScenarioMember[];
  budgetRules?: BudgetRule[];
  eventRefs?: ScenarioEventRef[];
  positions?: ScenarioPositions;
  clientComputed?: ScenarioClientComputed;
  meta?: ScenarioMeta;
};

type ScenarioStoreState = {
  scenarios: Scenario[];
  eventLibrary: EventDefinition[];
  activeScenarioId: string;
  didHydrate: boolean;
  isHydrating: boolean;
  setHydrationState: (state: { didHydrate?: boolean; isHydrating?: boolean }) => void;
  createScenario: (name: string, options?: { baseCurrency?: string }) => Scenario;
  renameScenario: (id: string, name: string) => void;
  duplicateScenario: (id: string) => Scenario | null;
  deleteScenario: (id: string) => void;
  setActiveScenario: (id: string) => void;
  updateScenarioKpis: (id: string, kpis: ScenarioKpis) => void;
  upsertScenarioEventRefs: (id: string, eventRefs: ScenarioEventRef[]) => void;
  addScenarioEventRef: (id: string, ref: ScenarioEventRef) => void;
  addEventToScenarios: (
    definition: EventDefinition,
    scenarioIds: string[],
    overrides?: ScenarioEventRef["overrides"]
  ) => void;
  updateScenarioEventRef: (
    id: string,
    refId: string,
    patch: Partial<ScenarioEventRef>
  ) => void;
  removeScenarioEventRef: (id: string, refId: string) => void;
  addEventDefinition: (definition: EventDefinition) => void;
  updateEventDefinition: (
    id: string,
    patch: Partial<EventDefinition>
  ) => void;
  removeEventDefinition: (id: string) => void;
  setEventLibrary: (eventLibrary: EventDefinition[]) => void;
  addScenarioMember: (id: string, member: ScenarioMember) => void;
  updateScenarioMember: (
    id: string,
    memberId: string,
    patch: Partial<ScenarioMember>
  ) => void;
  removeScenarioMember: (id: string, memberId: string) => void;
  addBudgetRule: (id: string, rule: BudgetRule) => void;
  updateBudgetRule: (
    id: string,
    ruleId: string,
    patch: Partial<BudgetRule>
  ) => void;
  removeBudgetRule: (id: string, ruleId: string) => void;
  addHomePosition: (id: string, home: HomePositionDraft) => void;
  updateHomePosition: (id: string, home: HomePositionDraft) => void;
  removeHomePosition: (id: string, homeId: string) => void;
  addCarPosition: (id: string, car: CarPosition) => void;
  updateCarPosition: (id: string, car: CarPosition) => void;
  removeCarPosition: (id: string, carId: string) => void;
  addInvestmentPosition: (id: string, investment: InvestmentPosition) => void;
  updateInvestmentPosition: (id: string, investment: InvestmentPosition) => void;
  removeInvestmentPosition: (id: string, investmentId: string) => void;
  addLoanPosition: (id: string, loan: LoanPosition) => void;
  updateLoanPosition: (id: string, loan: LoanPosition) => void;
  removeLoanPosition: (id: string, loanId: string) => void;
  addInsurancePosition: (id: string, insurance: InsurancePosition) => void;
  updateInsurancePosition: (id: string, insurance: InsurancePosition) => void;
  removeInsurancePosition: (id: string, insuranceId: string) => void;
  addCashBucketPosition: (id: string, bucket: CashBucketPosition) => void;
  updateCashBucketPosition: (id: string, bucket: CashBucketPosition) => void;
  removeCashBucketPosition: (id: string, bucketId: string) => void;
  updateScenarioMeta: (id: string, patch: Partial<ScenarioMeta>) => void;
  updateScenarioClientComputed: (
    id: string,
    patch: Partial<ScenarioClientComputed>
  ) => void;
  upsertScenarioMember: (id: string, member: ScenarioMember) => void;
  upsertScenarioEventRef: (id: string, ref: ScenarioEventRef) => void;
  upsertEventDefinition: (definition: EventDefinition) => void;
  mergeDuplicateEvents: (cluster: DuplicateCluster, baseDefinitionId: string) => void;
  updateScenarioUpdatedAt: (id: string) => void;
  updateScenarioAssumptions: (
    id: string,
    patch: Partial<ScenarioAssumptions>
  ) => void;
  setScenarioHorizonMonths: (id: string, horizonMonths: number) => void;
  setScenarioInitialCash: (id: string, initialCash: number) => void;
  setScenarioBaseMonth: (id: string, baseMonth: string | null) => void;
  setAssumptionsPartial: (id: string, patch: Partial<ScenarioAssumptions>) => void;
  replaceScenario: (scenario: Scenario) => void;
  replaceAllScenarios: (scenarios: Scenario[]) => void;
};

export type ScenarioStorePersistedState = Pick<
  ScenarioStoreState,
  "scenarios" | "eventLibrary" | "activeScenarioId"
>;

export const selectPersistedState = (
  state: ScenarioStoreState
): ScenarioStorePersistedState => ({
  scenarios: state.scenarios,
  eventLibrary: state.eventLibrary,
  activeScenarioId: state.activeScenarioId,
});

export const selectHasExistingProfile = (state: ScenarioStoreState): boolean =>
  state.scenarios.length > 0 && Boolean(state.activeScenarioId);

export const hydrateFromPersistedState = (
  payload: ScenarioStorePersistedState
): ScenarioStorePersistedState => {
  const normalizedScenarios = normalizeScenarioList(payload.scenarios);
  const normalizedActiveScenarioId = normalizedScenarios.some(
    (scenario) => scenario.id === payload.activeScenarioId
  )
    ? payload.activeScenarioId
    : normalizedScenarios[0]?.id ?? "";

  useScenarioStore.setState({
    scenarios: normalizedScenarios,
    eventLibrary: payload.eventLibrary,
    activeScenarioId: normalizedActiveScenarioId,
  });

  return {
    scenarios: normalizedScenarios,
    eventLibrary: payload.eventLibrary,
    activeScenarioId: normalizedActiveScenarioId,
  };
};

const defaultKpis: ScenarioKpis = {
  lowestMonthlyBalance: -8000,
  runwayMonths: 14,
  netWorthYear5: 1200000,
  riskLevel: "Medium",
};

const defaultAssumptions: ScenarioAssumptions = {
  horizonMonths: 240,
  initialCash: 0,
  baseMonth: null,
  includeBudgetRulesInProjection: true,
};

const horizonRange = { min: 60, max: 480 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const isValidBaseMonth = (value: string) => isValidMonthStr(value);

const now = () => Date.now();

const createScenarioId = () => `scenario-${nanoid(8)}`;
export const createHomePositionId = () => `home-${nanoid(8)}`;
export const createCarPositionId = () => `car-${nanoid(8)}`;
export const createInvestmentPositionId = () => `investment-${nanoid(8)}`;
export const createLoanPositionId = () => `loan-${nanoid(8)}`;
export const createInsurancePositionId = () => `insurance-${nanoid(8)}`;
export const createCashBucketPositionId = () => `cash-${nanoid(8)}`;
export const createMemberId = () => `member-${nanoid(8)}`;
export const createBudgetRuleId = () => `budget-${nanoid(8)}`;

const DEFAULT_MEMBER_NAME = "本人";

const normalizeMembers = (members?: ScenarioMember[]): ScenarioMember[] => {
  if (members && members.length > 0) {
    return members.map((member) => ({ ...member }));
  }

  return [
    {
      id: createMemberId(),
      name: DEFAULT_MEMBER_NAME,
      kind: "person",
    },
  ];
};

const normalizeBudgetRules = (rules?: BudgetRule[]): BudgetRule[] =>
  rules?.map((rule) => ({
    ...rule,
    ageBand: { ...rule.ageBand },
  })) ?? [];

const cloneEventRefs = (eventRefs?: ScenarioEventRef[]) =>
  eventRefs?.map((ref) => ({
    ...ref,
    overrides: ref.overrides ? { ...ref.overrides } : undefined,
  }));

const cloneMembers = (members?: ScenarioMember[]) =>
  members?.map((member) => ({
    ...member,
  }));

const cloneBudgetRules = (rules?: BudgetRule[]) =>
  rules?.map((rule) => ({
    ...rule,
    ageBand: { ...rule.ageBand },
  }));

const cloneClientComputed = (clientComputed?: ScenarioClientComputed) =>
  clientComputed ? { ...clientComputed } : undefined;

const clonePositions = (positions?: ScenarioPositions): ScenarioPositions | undefined => {
  if (!positions) {
    return positions;
  }

  return {
    home: positions.home ? { ...positions.home } : undefined,
    homes: positions.homes ? positions.homes.map((home) => ({ ...home })) : undefined,
    investments: positions.investments
      ? positions.investments.map((investment) => ({ ...investment }))
      : undefined,
    insurances: positions.insurances
      ? positions.insurances.map((insurance) => ({ ...insurance }))
      : undefined,
    loans: positions.loans ? positions.loans.map((loan) => ({ ...loan })) : undefined,
    cars: positions.cars
      ? positions.cars.map((car) => ({
          ...car,
          loan: car.loan ? { ...car.loan } : undefined,
        }))
      : undefined,
    cashBuckets: positions.cashBuckets
      ? positions.cashBuckets.map((bucket) => ({ ...bucket }))
      : undefined,
  };
};

const initialEventLibrary: EventDefinition[] = [
  {
    id: "event-plan-a-rent",
    title: "City Center Lease",
    type: "rent",
    kind: "cashflow",
    rule: {
      mode: "params",
      startMonth: "2024-09",
      endMonth: null,
      monthlyAmount: 1800,
      oneTimeAmount: 0,
      annualGrowthPct: 3,
    },
    currency: defaultCurrency,
  },
  {
    id: "event-plan-a-baby",
    title: "Newborn Expenses",
    type: "baby",
    kind: "cashflow",
    rule: {
      mode: "params",
      startMonth: "2025-06",
      endMonth: "2026-06",
      monthlyAmount: 950,
      oneTimeAmount: 5000,
      annualGrowthPct: 2,
    },
    currency: defaultCurrency,
  },
];

const initialScenarios: Scenario[] = [
  {
    id: "scenario-plan-a",
    name: "Plan A",
    baseCurrency: defaultCurrency,
    updatedAt: 1716806400000,
    kpis: {
      lowestMonthlyBalance: -12000,
      runwayMonths: 18,
      netWorthYear5: 1650000,
      riskLevel: "Medium",
    },
    assumptions: { ...defaultAssumptions },
    members: normalizeMembers(),
    budgetRules: [],
    eventRefs: [
      { refId: "event-plan-a-rent", enabled: true },
      { refId: "event-plan-a-baby", enabled: true },
    ],
  },
];

const ensureHomePositionId = (home: HomePosition | HomePositionDraft): HomePositionDraft => ({
  id: "id" in home ? home.id : createHomePositionId(),
  usage: home.usage ?? "primary",
  mode: home.mode ?? "new_purchase",
  purchasePrice: home.purchasePrice,
  downPayment: home.downPayment,
  purchaseMonth: home.purchaseMonth,
  annualAppreciationPct: home.annualAppreciationPct,
  mortgageRatePct: home.mortgageRatePct,
  mortgageTermYears: home.mortgageTermYears,
  feesOneTime: home.feesOneTime,
  holdingCostMonthly: home.holdingCostMonthly,
  holdingCostAnnualGrowthPct: home.holdingCostAnnualGrowthPct,
  existing: home.existing ? { ...home.existing } : undefined,
  rental: home.rental ? { ...home.rental } : undefined,
});

const ensureInvestmentPositionId = (
  investment: InvestmentPosition
): InvestmentPositionDraft => ({
  ...investment,
  id: investment.id ?? createInvestmentPositionId(),
});

const ensureLoanPositionId = (loan: LoanPosition): LoanPositionDraft => ({
  ...loan,
  id: loan.id ?? createLoanPositionId(),
});

const ensureCarPositionId = (car: CarPosition): CarPositionDraft => ({
  ...car,
  id: car.id ?? createCarPositionId(),
  loan: car.loan ? { ...car.loan } : undefined,
});

const ensureInsurancePositionId = (
  insurance: InsurancePosition
): InsurancePositionDraft => ({
  ...insurance,
  id: insurance.id ?? createInsurancePositionId(),
});

const ensureCashBucketPositionId = (
  bucket: CashBucketPosition
): CashBucketPositionDraft => ({
  ...bucket,
  id: bucket.id ?? createCashBucketPositionId(),
});

const normalizeScenarioPositions = (
  positions?: ScenarioPositions
): ScenarioPositions | undefined => {
  if (!positions) {
    return positions;
  }

  const normalizedHomes = positions.homes
    ? positions.homes.map(ensureHomePositionId)
    : positions.home
      ? [ensureHomePositionId(positions.home)]
      : undefined;

  return {
    ...positions,
    homes: normalizedHomes,
    investments: positions.investments
      ? positions.investments.map(ensureInvestmentPositionId)
      : positions.investments,
    insurances: positions.insurances
      ? positions.insurances.map(ensureInsurancePositionId)
      : positions.insurances,
    loans: positions.loans ? positions.loans.map(ensureLoanPositionId) : positions.loans,
    cars: positions.cars ? positions.cars.map(ensureCarPositionId) : positions.cars,
    cashBuckets: positions.cashBuckets
      ? positions.cashBuckets.map(ensureCashBucketPositionId)
      : positions.cashBuckets,
  };
};

export const normalizeScenario = (scenario: Scenario): Scenario => {
  const normalizedPositions = normalizeScenarioPositions(scenario.positions);
  const normalizedMembers = normalizeMembers(scenario.members);
  const normalizedEventRefs = scenario.eventRefs ?? [];
  const normalizedBudgetRules = normalizeBudgetRules(scenario.budgetRules);
  const normalizedClientComputed = cloneClientComputed(scenario.clientComputed);
  const normalizedAssumptions = {
    ...defaultAssumptions,
    ...scenario.assumptions,
  };

  if (!normalizedPositions) {
    return {
      ...scenario,
      assumptions: normalizedAssumptions,
      members: normalizedMembers,
      budgetRules: normalizedBudgetRules,
      eventRefs: normalizedEventRefs,
      clientComputed: normalizedClientComputed,
    };
  }

  return {
    ...scenario,
    assumptions: normalizedAssumptions,
    positions: normalizedPositions,
    members: normalizedMembers,
    budgetRules: normalizedBudgetRules,
    eventRefs: normalizedEventRefs,
    clientComputed: normalizedClientComputed,
  };
};

export const normalizeScenarioList = (scenarios: Scenario[]) =>
  scenarios.map((scenario) => normalizeScenario(scenario));

export const getScenarioById = (scenarios: Scenario[], id: string | null) =>
  scenarios.find((scenario) => scenario.id === id) ?? null;

export const getActiveScenario = (
  scenarios: Scenario[],
  activeScenarioId: string | null
) =>
  scenarios.find((scenario) => scenario.id === activeScenarioId) ??
  scenarios[0] ??
  null;

export const resolveScenarioIdFromQuery = (
  scenarioId: string | null,
  activeScenarioId: string | null,
  scenarios: Scenario[]
) => {
  if (scenarioId && scenarios.some((scenario) => scenario.id === scenarioId)) {
    return scenarioId;
  }

  if (activeScenarioId && scenarios.some((scenario) => scenario.id === activeScenarioId)) {
    return activeScenarioId;
  }

  return scenarios[0]?.id ?? "";
};

export const resetScenarioStore = () => {
  const nextScenarios = normalizeScenarioList(initialScenarios).map((scenario) => ({
    ...scenario,
    updatedAt: now(),
  }));

  useScenarioStore.setState({
    scenarios: nextScenarios,
    eventLibrary: initialEventLibrary,
    activeScenarioId: nextScenarios[0]?.id ?? "",
  });
};

export const useScenarioStore = create<ScenarioStoreState>((set, get) => ({
  scenarios: normalizeScenarioList(initialScenarios),
  eventLibrary: initialEventLibrary,
  activeScenarioId: initialScenarios[0]?.id ?? "",
  didHydrate: false,
  isHydrating: false,
  setHydrationState: (patch) => {
    set((state) => ({
      didHydrate: patch.didHydrate ?? state.didHydrate,
      isHydrating: patch.isHydrating ?? state.isHydrating,
    }));
  },
  createScenario: (name, options) => {
    const newScenario: Scenario = {
      id: createScenarioId(),
      name,
      baseCurrency: options?.baseCurrency ?? defaultCurrency,
      updatedAt: now(),
      kpis: { ...defaultKpis },
      assumptions: { ...defaultAssumptions },
      members: normalizeMembers(),
      budgetRules: [],
      eventRefs: [],
    };

    set((state) => ({
      scenarios: [newScenario, ...state.scenarios],
    }));

    return newScenario;
  },
  renameScenario: (id, name) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              name,
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  duplicateScenario: (id) => {
    const source = get().scenarios.find((scenario) => scenario.id === id);
    if (!source) {
      return null;
    }

    const copy: Scenario = {
      ...source,
      id: createScenarioId(),
      name: `${source.name} (Copy)`,
      updatedAt: now(),
      kpis: { ...source.kpis },
      assumptions: { ...source.assumptions },
      members: cloneMembers(source.members) ?? normalizeMembers(),
      budgetRules: cloneBudgetRules(source.budgetRules),
      eventRefs: cloneEventRefs(source.eventRefs),
      positions: clonePositions(source.positions),
      clientComputed: cloneClientComputed(source.clientComputed),
      meta: source.meta ? { ...source.meta } : undefined,
    };

    set((state) => ({
      scenarios: [copy, ...state.scenarios],
      activeScenarioId: copy.id,
    }));

    return copy;
  },
  deleteScenario: (id) => {
    set((state) => {
      if (state.scenarios.length <= 1) {
        return state;
      }

      const remaining = state.scenarios.filter((scenario) => scenario.id !== id);
      const nextActiveId =
        state.activeScenarioId === id
          ? remaining[0]?.id ?? ""
          : state.activeScenarioId;

      return {
        scenarios: remaining.map((scenario) =>
          scenario.id === nextActiveId
            ? { ...scenario, updatedAt: now() }
            : scenario
        ),
        activeScenarioId: nextActiveId,
      };
    });
  },
  setActiveScenario: (id) => {
    set((state) => {
      if (!state.scenarios.some((scenario) => scenario.id === id)) {
        return state;
      }

      return {
        activeScenarioId: id,
        scenarios: state.scenarios.map((scenario) =>
          scenario.id === id ? { ...scenario, updatedAt: now() } : scenario
        ),
      };
    });
  },
  updateScenarioKpis: (id, kpis) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              kpis,
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  upsertScenarioEventRefs: (id, eventRefs) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              eventRefs,
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  addScenarioEventRef: (id, ref) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              eventRefs: [...(scenario.eventRefs ?? []), { ...ref }],
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  addEventToScenarios: (definition, scenarioIds, overrides) => {
    const scenarioIdSet = new Set(scenarioIds);
    set((state) => ({
      eventLibrary: [...state.eventLibrary, { ...definition }],
      scenarios: state.scenarios.map((scenario) => {
        if (!scenarioIdSet.has(scenario.id)) {
          return scenario;
        }
        const existingRefs = scenario.eventRefs ?? [];
        if (existingRefs.some((ref) => ref.refId === definition.id)) {
          return scenario;
        }
        const nextRef: ScenarioEventRef = {
          refId: definition.id,
          enabled: true,
          overrides: overrides ? { ...overrides } : undefined,
        };
        return {
          ...scenario,
          eventRefs: [...existingRefs, nextRef],
          updatedAt: now(),
        };
      }),
    }));
  },
  updateScenarioEventRef: (id, refId, patch) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              eventRefs: (scenario.eventRefs ?? []).map((ref) =>
                ref.refId === refId
                  ? {
                      ...ref,
                      ...patch,
                      overrides: patch.overrides
                        ? { ...patch.overrides }
                        : ref.overrides,
                    }
                  : ref
              ),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  upsertScenarioEventRef: (id, ref) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const existing = scenario.eventRefs ?? [];
        const hasMatch = existing.some((entry) => entry.refId === ref.refId);
        const nextRefs = hasMatch
          ? existing.map((entry) =>
              entry.refId === ref.refId
                ? {
                    ...entry,
                    ...ref,
                    overrides: ref.overrides
                      ? { ...ref.overrides }
                      : entry.overrides,
                  }
                : entry
            )
          : [...existing, { ...ref }];

        return {
          ...scenario,
          eventRefs: nextRefs,
          updatedAt: now(),
        };
      }),
    }));
  },
  removeScenarioEventRef: (id, refId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              eventRefs: (scenario.eventRefs ?? []).filter((ref) => ref.refId !== refId),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  addEventDefinition: (definition) => {
    set((state) => ({
      eventLibrary: [...state.eventLibrary, { ...definition }],
    }));
  },
  upsertEventDefinition: (definition) => {
    set((state) => {
      const hasMatch = state.eventLibrary.some((entry) => entry.id === definition.id);
      return {
        eventLibrary: hasMatch
          ? state.eventLibrary.map((entry) =>
              entry.id === definition.id ? { ...entry, ...definition } : entry
            )
          : [...state.eventLibrary, { ...definition }],
      };
    });
  },
  updateEventDefinition: (id, patch) => {
    set((state) => ({
      eventLibrary: state.eventLibrary.map((definition) =>
        definition.id === id
          ? {
              ...definition,
              ...patch,
              rule: patch.rule
                ? {
                    ...definition.rule,
                    ...patch.rule,
                    mode: "params",
                  }
                : definition.rule,
            }
          : definition
      ),
    }));
  },
  removeEventDefinition: (id) => {
    set((state) => ({
      eventLibrary: state.eventLibrary.filter((definition) => definition.id !== id),
      scenarios: state.scenarios.map((scenario) => ({
        ...scenario,
        eventRefs: (scenario.eventRefs ?? []).filter((ref) => ref.refId !== id),
      })),
    }));
  },
  setEventLibrary: (eventLibrary) => {
    set(() => ({
      eventLibrary,
    }));
  },
  addScenarioMember: (id, member) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              members: [...(scenario.members ?? []), { ...member }],
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateScenarioMember: (id, memberId, patch) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              members: (scenario.members ?? []).map((member) =>
                member.id === memberId ? { ...member, ...patch } : member
              ),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  upsertScenarioMember: (id, member) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const existingMembers = scenario.members ?? [];
        const hasMatch = existingMembers.some((entry) => entry.id === member.id);
        const nextMembers = hasMatch
          ? existingMembers.map((entry) =>
              entry.id === member.id ? { ...entry, ...member } : entry
            )
          : [...existingMembers, { ...member }];

        return {
          ...scenario,
          members: nextMembers,
          updatedAt: now(),
        };
      }),
    }));
  },
  removeScenarioMember: (id, memberId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              members: (scenario.members ?? []).filter(
                (member) => member.id !== memberId
              ),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  addBudgetRule: (id, rule) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              budgetRules: [...(scenario.budgetRules ?? []), { ...rule }],
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateBudgetRule: (id, ruleId, patch) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              budgetRules: (scenario.budgetRules ?? []).map((rule) =>
                rule.id === ruleId
                  ? {
                      ...rule,
                      ...patch,
                      ageBand: patch.ageBand
                        ? { ...patch.ageBand }
                        : { ...rule.ageBand },
                    }
                  : rule
              ),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  removeBudgetRule: (id, ruleId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              budgetRules: (scenario.budgetRules ?? []).filter(
                (rule) => rule.id !== ruleId
              ),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  addHomePosition: (id, home) => {
    const nextHome = ensureHomePositionId(home);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              positions: normalizeScenarioPositions({
                ...(scenario.positions ?? {}),
                homes: [...(scenario.positions?.homes ?? []), nextHome],
              }),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateHomePosition: (id, home) => {
    const nextHome = ensureHomePositionId(home);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const existingHomes = scenario.positions?.homes ?? [];
        const hasMatch = existingHomes.some((entry) => entry.id === nextHome.id);
        const nextHomes = hasMatch
          ? existingHomes.map((entry) =>
              entry.id === nextHome.id ? nextHome : entry
            )
          : [...existingHomes, nextHome];

        return {
          ...scenario,
          positions: normalizeScenarioPositions({
            ...(scenario.positions ?? {}),
            homes: nextHomes,
          }),
          updatedAt: now(),
        };
      }),
    }));
  },
  removeHomePosition: (id, homeId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const nextHomes = (scenario.positions?.homes ?? []).filter(
          (home) => home.id !== homeId
        );
        const { home: legacyHome, ...otherPositions } = scenario.positions ?? {};
        void legacyHome;
        const nextPositions: ScenarioPositions | undefined = scenario.positions
          ? {
              ...otherPositions,
              homes: nextHomes,
            }
          : undefined;
        const eventLibraryMap = buildEventLibraryMap(get().eventLibrary);
        const nextEventRefs =
          nextHomes.length === 0
            ? (scenario.eventRefs ?? []).filter((ref) => {
                const definition = eventLibraryMap.get(ref.refId);
                return definition?.type !== "buy_home";
              })
            : scenario.eventRefs;

        return {
          ...scenario,
          eventRefs: nextEventRefs,
          positions: normalizeScenarioPositions(nextPositions),
          updatedAt: now(),
        };
      }),
    }));
  },
  addCarPosition: (id, car) => {
    const nextCar = ensureCarPositionId(car);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              positions: normalizeScenarioPositions({
                ...(scenario.positions ?? {}),
                cars: [...(scenario.positions?.cars ?? []), nextCar],
              }),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateCarPosition: (id, car) => {
    const nextCar = ensureCarPositionId(car);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const existingCars = scenario.positions?.cars ?? [];
        const hasMatch = existingCars.some((entry) => entry.id === nextCar.id);
        const nextCars = hasMatch
          ? existingCars.map((entry) => (entry.id === nextCar.id ? nextCar : entry))
          : [...existingCars, nextCar];

        return {
          ...scenario,
          positions: normalizeScenarioPositions({
            ...(scenario.positions ?? {}),
            cars: nextCars,
          }),
          updatedAt: now(),
        };
      }),
    }));
  },
  removeCarPosition: (id, carId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const nextCars = (scenario.positions?.cars ?? []).filter(
          (car) => car.id !== carId
        );

        return {
          ...scenario,
          positions: normalizeScenarioPositions({
            ...(scenario.positions ?? {}),
            cars: nextCars,
          }),
          updatedAt: now(),
        };
      }),
    }));
  },
  addInvestmentPosition: (id, investment) => {
    const nextInvestment = ensureInvestmentPositionId(investment);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              positions: normalizeScenarioPositions({
                ...(scenario.positions ?? {}),
                investments: [
                  ...(scenario.positions?.investments ?? []),
                  nextInvestment,
                ],
              }),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateInvestmentPosition: (id, investment) => {
    const nextInvestment = ensureInvestmentPositionId(investment);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const existingInvestments = scenario.positions?.investments ?? [];
        const hasMatch = existingInvestments.some(
          (entry) => entry.id === nextInvestment.id
        );
        const nextInvestments = hasMatch
          ? existingInvestments.map((entry) =>
              entry.id === nextInvestment.id ? nextInvestment : entry
            )
          : [...existingInvestments, nextInvestment];

        return {
          ...scenario,
          positions: normalizeScenarioPositions({
            ...(scenario.positions ?? {}),
            investments: nextInvestments,
          }),
          updatedAt: now(),
        };
      }),
    }));
  },
  removeInvestmentPosition: (id, investmentId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const nextInvestments = (scenario.positions?.investments ?? []).filter(
          (investment) => investment.id !== investmentId
        );

        return {
          ...scenario,
          positions: normalizeScenarioPositions({
            ...(scenario.positions ?? {}),
            investments: nextInvestments,
          }),
          updatedAt: now(),
        };
      }),
    }));
  },
  addLoanPosition: (id, loan) => {
    const nextLoan = ensureLoanPositionId(loan);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              positions: normalizeScenarioPositions({
                ...(scenario.positions ?? {}),
                loans: [...(scenario.positions?.loans ?? []), nextLoan],
              }),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateLoanPosition: (id, loan) => {
    const nextLoan = ensureLoanPositionId(loan);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const existingLoans = scenario.positions?.loans ?? [];
        const hasMatch = existingLoans.some((entry) => entry.id === nextLoan.id);
        const nextLoans = hasMatch
          ? existingLoans.map((entry) => (entry.id === nextLoan.id ? nextLoan : entry))
          : [...existingLoans, nextLoan];

        return {
          ...scenario,
          positions: normalizeScenarioPositions({
            ...(scenario.positions ?? {}),
            loans: nextLoans,
          }),
          updatedAt: now(),
        };
      }),
    }));
  },
  removeLoanPosition: (id, loanId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const nextLoans = (scenario.positions?.loans ?? []).filter(
          (loan) => loan.id !== loanId
        );

        return {
          ...scenario,
          positions: normalizeScenarioPositions({
            ...(scenario.positions ?? {}),
            loans: nextLoans,
          }),
          updatedAt: now(),
        };
      }),
    }));
  },
  addInsurancePosition: (id, insurance) => {
    const nextInsurance = ensureInsurancePositionId(insurance);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              positions: normalizeScenarioPositions({
                ...(scenario.positions ?? {}),
                insurances: [
                  ...(scenario.positions?.insurances ?? []),
                  nextInsurance,
                ],
              }),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateInsurancePosition: (id, insurance) => {
    const nextInsurance = ensureInsurancePositionId(insurance);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const existingInsurances = scenario.positions?.insurances ?? [];
        const hasMatch = existingInsurances.some(
          (entry) => entry.id === nextInsurance.id
        );
        const nextInsurances = hasMatch
          ? existingInsurances.map((entry) =>
              entry.id === nextInsurance.id ? nextInsurance : entry
            )
          : [...existingInsurances, nextInsurance];

        return {
          ...scenario,
          positions: normalizeScenarioPositions({
            ...(scenario.positions ?? {}),
            insurances: nextInsurances,
          }),
          updatedAt: now(),
        };
      }),
    }));
  },
  removeInsurancePosition: (id, insuranceId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const nextInsurances = (scenario.positions?.insurances ?? []).filter(
          (insurance) => insurance.id !== insuranceId
        );

        return {
          ...scenario,
          positions: normalizeScenarioPositions({
            ...(scenario.positions ?? {}),
            insurances: nextInsurances,
          }),
          updatedAt: now(),
        };
      }),
    }));
  },
  addCashBucketPosition: (id, bucket) => {
    const nextBucket = ensureCashBucketPositionId(bucket);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              positions: normalizeScenarioPositions({
                ...(scenario.positions ?? {}),
                cashBuckets: [
                  ...(scenario.positions?.cashBuckets ?? []),
                  nextBucket,
                ],
              }),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateCashBucketPosition: (id, bucket) => {
    const nextBucket = ensureCashBucketPositionId(bucket);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const existingBuckets = scenario.positions?.cashBuckets ?? [];
        const hasMatch = existingBuckets.some((entry) => entry.id === nextBucket.id);
        const nextBuckets = hasMatch
          ? existingBuckets.map((entry) =>
              entry.id === nextBucket.id ? nextBucket : entry
            )
          : [...existingBuckets, nextBucket];

        return {
          ...scenario,
          positions: normalizeScenarioPositions({
            ...(scenario.positions ?? {}),
            cashBuckets: nextBuckets,
          }),
          updatedAt: now(),
        };
      }),
    }));
  },
  removeCashBucketPosition: (id, bucketId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const nextBuckets = (scenario.positions?.cashBuckets ?? []).filter(
          (bucket) => bucket.id !== bucketId
        );

        return {
          ...scenario,
          positions: normalizeScenarioPositions({
            ...(scenario.positions ?? {}),
            cashBuckets: nextBuckets,
          }),
          updatedAt: now(),
        };
      }),
    }));
  },
  mergeDuplicateEvents: (cluster, baseDefinitionId) => {
    set((state) => {
      const baseDefinition = state.eventLibrary.find(
        (definition) => definition.id === baseDefinitionId
      );
      if (!baseDefinition) {
        return state;
      }

      const candidatesByScenario = new Map<string, Map<string, DuplicateCluster["candidates"][number]>>();
      cluster.candidates.forEach((candidate) => {
        const existing = candidatesByScenario.get(candidate.scenarioId);
        if (existing) {
          existing.set(candidate.ref.refId, candidate);
          return;
        }
        candidatesByScenario.set(
          candidate.scenarioId,
          new Map([[candidate.ref.refId, candidate]])
        );
      });

      const updatedScenarios = state.scenarios.map((scenario) => {
        const candidates = candidatesByScenario.get(scenario.id);
        if (!candidates) {
          return scenario;
        }

        const nextRefs = (scenario.eventRefs ?? []).map((ref) => {
          const candidate = candidates.get(ref.refId);
          if (!candidate) {
            return ref;
          }
          const effectiveRule =
            candidate.effectiveRule ??
            resolveEventRule(candidate.definition, candidate.ref);
          const overrides = buildEventRuleOverrides(baseDefinition.rule, effectiveRule);
          return {
            ...ref,
            refId: baseDefinitionId,
            overrides,
          };
        });

        return {
          ...scenario,
          eventRefs: nextRefs,
          updatedAt: now(),
        };
      });

      return {
        ...state,
        scenarios: updatedScenarios,
      };
    });
  },
  updateScenarioMeta: (id, patch) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              meta: { ...(scenario.meta ?? {}), ...patch },
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateScenarioClientComputed: (id, patch) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              clientComputed: { ...(scenario.clientComputed ?? {}), ...patch },
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateScenarioUpdatedAt: (id) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateScenarioAssumptions: (id, patch) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const nextAssumptions = { ...scenario.assumptions };

        if (Object.prototype.hasOwnProperty.call(patch, "horizonMonths")) {
          const horizon =
            typeof patch.horizonMonths === "number"
              ? clamp(patch.horizonMonths, horizonRange.min, horizonRange.max)
              : scenario.assumptions.horizonMonths;
          nextAssumptions.horizonMonths = horizon;
        }

        if (Object.prototype.hasOwnProperty.call(patch, "initialCash")) {
          const cash =
            typeof patch.initialCash === "number"
              ? Math.max(0, patch.initialCash)
              : scenario.assumptions.initialCash;
          nextAssumptions.initialCash = cash;
        }

        if (Object.prototype.hasOwnProperty.call(patch, "baseMonth")) {
          const baseMonth = patch.baseMonth;
          if (baseMonth === null) {
            nextAssumptions.baseMonth = null;
          } else if (typeof baseMonth === "string" && isValidBaseMonth(baseMonth)) {
            nextAssumptions.baseMonth = baseMonth;
          }
        }

        if (Object.prototype.hasOwnProperty.call(patch, "inflationRate")) {
          nextAssumptions.inflationRate = patch.inflationRate;
        }

        if (Object.prototype.hasOwnProperty.call(patch, "salaryGrowthRate")) {
          nextAssumptions.salaryGrowthRate = patch.salaryGrowthRate;
        }

        if (Object.prototype.hasOwnProperty.call(patch, "emergencyFundMonths")) {
          nextAssumptions.emergencyFundMonths = patch.emergencyFundMonths;
        }

        if (
          Object.prototype.hasOwnProperty.call(patch, "includeBudgetRulesInProjection")
        ) {
          nextAssumptions.includeBudgetRulesInProjection =
            patch.includeBudgetRulesInProjection ?? true;
        }

        return {
          ...scenario,
          assumptions: nextAssumptions,
          updatedAt: now(),
        };
      }),
    }));
  },
  setScenarioHorizonMonths: (id, horizonMonths) => {
    get().updateScenarioAssumptions(id, { horizonMonths });
  },
  setScenarioInitialCash: (id, initialCash) => {
    get().updateScenarioAssumptions(id, { initialCash });
  },
  setScenarioBaseMonth: (id, baseMonth) => {
    get().updateScenarioAssumptions(id, { baseMonth });
  },
  setAssumptionsPartial: (id, patch) => {
    get().updateScenarioAssumptions(id, patch);
  },
  replaceScenario: (scenario) => {
    const normalizedScenario = normalizeScenario(scenario);
    set((state) => {
      const exists = state.scenarios.some((entry) => entry.id === normalizedScenario.id);
      const scenarios = exists
        ? state.scenarios.map((entry) =>
            entry.id === normalizedScenario.id ? normalizedScenario : entry
          )
        : [normalizedScenario, ...state.scenarios];

      const nextActiveScenarioId = state.activeScenarioId
        ? state.activeScenarioId
        : scenarios[0]?.id ?? "";

      return {
        scenarios,
        activeScenarioId: nextActiveScenarioId,
      };
    });
  },
  replaceAllScenarios: (scenarios) => {
    const normalizedScenarios = normalizeScenarioList(scenarios);
    set(() => ({
      scenarios: normalizedScenarios,
      activeScenarioId: normalizedScenarios[0]?.id ?? "",
    }));
  },
}));
