// Shape note: Scenario positions.homes entries originally held price/downPayment/purchaseMonth/annualAppreciationPct/mortgage info (+feesOneTime).
// Added fields: holdingCostMonthly and holdingCostAnnualGrowthPct (percent for UI storage).
// Back-compat: missing holding cost fields default to 0 in adapters/engine.
import { nanoid } from "nanoid";
import { create } from "zustand";
import { defaultCurrency } from "../../lib/i18n";
import type { ApplyScope } from "../domain/applyScope";
import type { EventDefinition, ScenarioEventRef } from "../domain/events/types";
import type { Plan } from "../domain/planLab/types";
import type { SmartInvestPolicy } from "../domain/smartInvest/types";
import {
  buildEventRuleOverrides,
  type DuplicateCluster,
} from "../domain/events/mergeDuplicates";
import { buildEventLibraryMap, resolveEventRule } from "../domain/events/utils";
import { clearLocalData } from "../persistence/storage";
import { isValidMonthStr } from "../utils/month";

export type { EventType, TimelineEvent } from "../features/timeline/schema";

export type ScenarioRiskLevel = "Low" | "Medium" | "High";

export type OnboardingPersona = "forumKid" | "middleClassFamily" | "richSingle";

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
  smartInvest?: SmartInvestPolicy;
};

export type AppSettings = {
  globalBaseMonth: string | null;
  globalHorizonMonths: number;
  annualInflationPct: number;
  viewMode: "nominal" | "real";
};

export type ProjectionSnapshot = {
  id: string;
  label: string;
  monthIndex: number;
  cash: number;
  netWorth: number;
  assets: number;
  liabilities: number;
};

export type HomeUsage = "primary" | "investment";
export type HomeMode = "new_purchase" | "existing";

export type InvestmentAssetClass = "equity" | "bond" | "fund" | "crypto";

export type InsuranceKind = "protection" | "savings";

export type ScenarioMemberKind = "person" | "pet";

export type MemberMilestoneKind =
  | "birth"
  | "schoolStart"
  | "graduation"
  | "retirement"
  | "custom";

export type MemberMilestone = {
  id: string;
  kind: MemberMilestoneKind;
  label: string;
  month?: string;
  atAgeYears?: number;
  applyScope?: ApplyScope;
  sourceEventId?: string;
  metadata?: Record<string, string>;
};

export type ScenarioMember = {
  id: string;
  name: string;
  kind: ScenarioMemberKind;
  birthMonth?: string;
  ageAtBaseMonth?: number;
  applyScope?: ApplyScope;
  milestones?: MemberMilestone[];
};

export type BudgetCategory =
  | "health"
  | "baseline"
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
  applyScope?: ApplyScope;
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
  name?: string;
  ownerMemberId?: string;
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
  sellMonth?: string;
  sellPriceOverride?: number;
  sellFeesOneTime?: number;
  notes?: string;
  existing?: ExistingHomeDetails;
  rental?: RentalDetails;
};

export type HomePositionDraft = HomePosition & {
  id: string;
};

export type InvestmentPosition = {
  id?: string;
  name?: string;
  ownerMemberId?: string;
  assetClass?: InvestmentAssetClass;
  startMonth: string;
  initialValue: number;
  notes?: string;
  expectedAnnualReturnPct?: number;
  monthlyContribution?: number;
  monthlyWithdrawal?: number;
  feeAnnualRatePct?: number;
};

export type InsurancePosition = {
  id?: string;
  name: string;
  ownerMemberId?: string;
  enabled: boolean;
  kind: InsuranceKind;
  startMonth: string;
  endMonth?: string;
  premiumMonthly: number;
  premiumAnnualGrowthPct?: number;
  initialCashValue?: number;
  expectedAnnualReturnPct?: number;
  notes?: string;
};

export type LoanPosition = {
  id?: string;
  name?: string;
  ownerMemberId?: string;
  startMonth: string;
  principal: number;
  annualInterestRatePct: number;
  termYears: number;
  monthlyPayment?: number;
  paymentMethod?: "amortization" | "manual";
  feesOneTime?: number;
  notes?: string;
};

export type CarLoanDetails = {
  principal: number;
  annualInterestRatePct: number;
  termYears: number;
  monthlyPayment?: number;
};

export type CarPosition = {
  id?: string;
  name?: string;
  ownerMemberId?: string;
  purchaseMonth: string;
  purchasePrice: number;
  downPayment: number;
  annualDepreciationRatePct: number;
  holdingCostMonthly: number;
  holdingCostAnnualGrowthPct: number;
  loan?: CarLoanDetails;
  sellMonth?: string;
  sellPriceOverride?: number;
  sellFeesOneTime?: number;
  notes?: string;
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

export type PositionCopyType =
  | "home"
  | "car"
  | "investment"
  | "insurance"
  | "loan";

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
  version?: number;
  kpis: ScenarioKpis;
  assumptions: ScenarioAssumptions;
  eventRefs?: ScenarioEventRef[];
  positions?: ScenarioPositions;
  clientComputed?: ScenarioClientComputed;
  snapshots?: ProjectionSnapshot[];
  plans?: Plan[];
  meta?: ScenarioMeta;
};

type ScenarioStoreState = {
  scenarios: Scenario[];
  eventLibrary: EventDefinition[];
  activeScenarioId: string;
  appSettings: AppSettings;
  members: ScenarioMember[];
  budgetRules: BudgetRule[];
  didHydrate: boolean;
  isHydrating: boolean;
  setHydrationState: (state: { didHydrate?: boolean; isHydrating?: boolean }) => void;
  createScenario: (
    name: string,
    options?: { baseCurrency?: string; onboardingCompleted?: boolean }
  ) => Scenario;
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
  createMember: (member: ScenarioMember) => void;
  updateMember: (memberId: string, patch: Partial<ScenarioMember>) => void;
  deleteMember: (memberId: string) => void;
  setMemberApplyScope: (memberId: string, applyScope: ApplyScope) => void;
  createBudgetRule: (rule: BudgetRule) => void;
  updateBudgetRule: (ruleId: string, patch: Partial<BudgetRule>) => void;
  removeBudgetRule: (ruleId: string) => void;
  setScenarioPositions: (id: string, positions: ScenarioPositions) => void;
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
  copyPositionToScenarios: (
    sourceScenarioId: string,
    type: PositionCopyType,
    positionId: string,
    scenarioIds: string[]
  ) => void;
  copySmartInvestToScenarios: (
    sourceScenarioId: string,
    scenarioIds: string[]
  ) => void;
  updateScenarioMeta: (id: string, patch: Partial<ScenarioMeta>) => void;
  updateScenarioClientComputed: (
    id: string,
    patch: Partial<ScenarioClientComputed>
  ) => void;
  skipOnboardingForScenario: (id: string) => void;
  upsertScenarioEventRef: (id: string, ref: ScenarioEventRef) => void;
  upsertEventDefinition: (definition: EventDefinition) => void;
  mergeDuplicateEvents: (cluster: DuplicateCluster, baseDefinitionId: string) => void;
  updateScenarioUpdatedAt: (id: string) => void;
  updateScenarioAssumptions: (
    id: string,
    patch: Partial<ScenarioAssumptions>
  ) => void;
  setScenarioHorizonMonths: (id: string, horizonMonths: number) => void;
  setGlobalHorizonMonths: (horizonMonths: number) => void;
  setGlobalBaseMonth: (baseMonth: string | null) => void;
  setAnnualInflationPct: (value: number) => void;
  setViewMode: (value: AppSettings["viewMode"]) => void;
  setScenarioInitialCash: (id: string, initialCash: number) => void;
  setScenarioBaseMonth: (id: string, baseMonth: string | null) => void;
  setAssumptionsPartial: (id: string, patch: Partial<ScenarioAssumptions>) => void;
  updateSmartInvest: (id: string, policy: SmartInvestPolicy | null) => void;
  replaceScenario: (scenario: Scenario) => void;
  replaceAllScenarios: (scenarios: Scenario[]) => void;
  addSnapshot: (scenarioId: string, snapshot: ProjectionSnapshot) => void;
  removeSnapshot: (scenarioId: string, snapshotId: string) => void;
  clearSnapshots: (scenarioId: string) => void;
  upsertScenarioPlan: (scenarioId: string, plan: Plan) => void;
  removeScenarioPlan: (scenarioId: string, planId: string) => void;
};

export type ScenarioStorePersistedState = Pick<
  ScenarioStoreState,
  "scenarios" | "eventLibrary" | "activeScenarioId"
> & {
  members?: ScenarioMember[];
  budgetRules?: BudgetRule[];
  appSettings?: AppSettings;
  globalHorizonMonths?: number;
};

export const selectPersistedState = (
  state: ScenarioStoreState
): ScenarioStorePersistedState => ({
  scenarios: state.scenarios,
  eventLibrary: state.eventLibrary,
  activeScenarioId: state.activeScenarioId,
  globalHorizonMonths: state.appSettings.globalHorizonMonths,
  members: state.members,
  budgetRules: state.budgetRules,
  appSettings: state.appSettings,
});

export const selectHasExistingProfile = (state: ScenarioStoreState): boolean =>
  state.scenarios.length > 0;

export const hydrateFromPersistedState = (
  payload: ScenarioStorePersistedState
): ScenarioStorePersistedState => {
  const normalizedScenarios = normalizeScenarioList(payload.scenarios);
  const normalizedActiveScenarioId = normalizedScenarios.some(
    (scenario) => scenario.id === payload.activeScenarioId
  )
    ? payload.activeScenarioId
    : normalizedScenarios[0]?.id ?? "";
  const activeScenario =
    normalizedScenarios.find((scenario) => scenario.id === normalizedActiveScenarioId) ??
    normalizedScenarios[0];
  const fallbackHorizon = activeScenario?.assumptions.horizonMonths ?? defaultAppSettings.globalHorizonMonths;
  const normalizedGlobalHorizon =
    typeof payload.appSettings?.globalHorizonMonths === "number"
      ? clamp(payload.appSettings.globalHorizonMonths, horizonRange.min, horizonRange.max)
      : typeof payload.globalHorizonMonths === "number"
      ? clamp(payload.globalHorizonMonths, horizonRange.min, horizonRange.max)
      : clamp(fallbackHorizon, horizonRange.min, horizonRange.max);
  const normalizedBaseMonth =
    payload.appSettings?.globalBaseMonth ??
    activeScenario?.assumptions.baseMonth ??
    null;
  const normalizedInflationPct =
    typeof payload.appSettings?.annualInflationPct === "number"
      ? payload.appSettings.annualInflationPct
      : defaultAppSettings.annualInflationPct;
  const normalizedViewMode =
    payload.appSettings?.viewMode ?? defaultAppSettings.viewMode;
  const migratedMembers = migrateGlobalMembers(
    payload.members,
    payload.scenarios
  );
  const migratedBudgetRules = migrateGlobalBudgetRules(
    payload.budgetRules,
    payload.scenarios
  );
  const scenariosWithGlobalHorizon = normalizedScenarios.map((scenario) => ({
    ...scenario,
    assumptions: {
      ...scenario.assumptions,
      horizonMonths: normalizedGlobalHorizon,
    },
  }));

  useScenarioStore.setState({
    scenarios: scenariosWithGlobalHorizon,
    eventLibrary: payload.eventLibrary,
    activeScenarioId: normalizedActiveScenarioId,
    appSettings: {
      globalHorizonMonths: normalizedGlobalHorizon,
      globalBaseMonth: normalizedBaseMonth,
      annualInflationPct: normalizedInflationPct,
      viewMode: normalizedViewMode,
    },
    members: normalizeMembers(migratedMembers),
    budgetRules: normalizeBudgetRules(migratedBudgetRules),
  });

  return {
    scenarios: scenariosWithGlobalHorizon,
    eventLibrary: payload.eventLibrary,
    activeScenarioId: normalizedActiveScenarioId,
    globalHorizonMonths: normalizedGlobalHorizon,
    appSettings: {
      globalHorizonMonths: normalizedGlobalHorizon,
      globalBaseMonth: normalizedBaseMonth,
      annualInflationPct: normalizedInflationPct,
      viewMode: normalizedViewMode,
    },
    members: normalizeMembers(migratedMembers),
    budgetRules: normalizeBudgetRules(migratedBudgetRules),
  };
};

const defaultKpis: ScenarioKpis = {
  lowestMonthlyBalance: -8000,
  runwayMonths: 14,
  netWorthYear5: 1200000,
  riskLevel: "Medium",
};

const defaultAssumptions: ScenarioAssumptions = {
  horizonMonths: 60,
  initialCash: 0,
  baseMonth: null,
  includeBudgetRulesInProjection: true,
};

const defaultAppSettings: AppSettings = {
  globalBaseMonth: null,
  globalHorizonMonths: defaultAssumptions.horizonMonths,
  annualInflationPct: 0,
  viewMode: "nominal",
};

const horizonRange = { min: 60, max: 960 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const isValidBaseMonth = (value: string) => isValidMonthStr(value);

const now = () => Date.now();
const defaultScenarioVersion = 1;

const ensureScenarioVersion = (scenario: Scenario) =>
  scenario.version ?? defaultScenarioVersion;

const bumpScenarioVersion = (scenario: Scenario) =>
  ensureScenarioVersion(scenario) + 1;

const clonePlanSnapshot = (snapshot: Plan["snapshot"]) =>
  JSON.parse(JSON.stringify(snapshot ?? {})) as Plan["snapshot"];

const clonePlans = (plans?: Plan[]) =>
  plans?.map((plan) => ({
    ...plan,
    snapshot: clonePlanSnapshot(plan.snapshot),
    metricsCache: plan.metricsCache ? { ...plan.metricsCache } : undefined,
  })) ?? [];

const createScenarioId = () => `scenario-${nanoid(8)}`;
export const createHomePositionId = () => `home-${nanoid(8)}`;
export const createCarPositionId = () => `car-${nanoid(8)}`;
export const createInvestmentPositionId = () => `investment-${nanoid(8)}`;
export const createLoanPositionId = () => `loan-${nanoid(8)}`;
export const createInsurancePositionId = () => `insurance-${nanoid(8)}`;
export const createCashBucketPositionId = () => `cash-${nanoid(8)}`;
export const createMemberId = () => `member-${nanoid(8)}`;
export const createBudgetRuleId = () => `budget-${nanoid(8)}`;

const DEFAULT_MEMBER_NAME = "主要成員";

const normalizeApplyScope = (applyScope?: ApplyScope): ApplyScope =>
  applyScope ?? { scope: "all" };

const normalizeMemberMilestones = (
  milestones?: MemberMilestone[]
): MemberMilestone[] =>
  milestones?.map((milestone) => ({
    ...milestone,
    applyScope: normalizeApplyScope(milestone.applyScope),
  })) ?? [];

const normalizeMembers = (members?: ScenarioMember[]): ScenarioMember[] => {
  if (members && members.length > 0) {
    return members.map((member) => ({
      ...member,
      name: member.name.trim() === "本人" ? DEFAULT_MEMBER_NAME : member.name,
      applyScope: normalizeApplyScope(member.applyScope),
      milestones: normalizeMemberMilestones(member.milestones),
    }));
  }

  return [
    {
      id: createMemberId(),
      name: DEFAULT_MEMBER_NAME,
      kind: "person",
      applyScope: { scope: "all" },
      milestones: [],
    },
  ];
};

const normalizeBudgetRules = (rules?: BudgetRule[]): BudgetRule[] =>
  rules?.map((rule) => ({
    ...rule,
    ageBand: { ...rule.ageBand },
    applyScope: normalizeApplyScope(rule.applyScope),
  })) ?? [];

const ensureScenarioIncluded = (
  applyScope: ApplyScope | undefined,
  scenarioId: string
): ApplyScope => {
  if (!applyScope || applyScope.scope === "all") {
    return { scope: "all" };
  }
  if (applyScope.scope === "include") {
    const scenarioIds = Array.from(new Set([...applyScope.scenarioIds, scenarioId]));
    return { scope: "include", scenarioIds };
  }
  return applyScope;
};

const migrateGlobalMembers = (
  members: ScenarioMember[] | undefined,
  scenarios: Scenario[]
): ScenarioMember[] => {
  const memberMap = new Map<string, ScenarioMember>();

  const upsertMember = (member: ScenarioMember, scenarioId?: string) => {
    const existing = memberMap.get(member.id);
    if (existing) {
      memberMap.set(member.id, {
        ...existing,
        ...member,
        applyScope: scenarioId
          ? ensureScenarioIncluded(existing.applyScope, scenarioId)
          : existing.applyScope ?? member.applyScope,
        milestones: member.milestones ?? existing.milestones,
      });
      return;
    }
    memberMap.set(member.id, {
      ...member,
      applyScope: scenarioId
        ? { scope: "include", scenarioIds: [scenarioId] }
        : member.applyScope ?? { scope: "all" },
      milestones: member.milestones ?? [],
    });
  };

  members?.forEach((member) => upsertMember(member));

  scenarios.forEach((scenario) => {
    const legacyMembers = (scenario as LegacyScenario).members ?? [];
    legacyMembers.forEach((member) => upsertMember(member, scenario.id));
  });

  return Array.from(memberMap.values());
};

const migrateGlobalBudgetRules = (
  rules: BudgetRule[] | undefined,
  scenarios: Scenario[]
): BudgetRule[] => {
  const ruleMap = new Map<string, BudgetRule>();

  const upsertRule = (rule: BudgetRule, scenarioId?: string) => {
    const existing = ruleMap.get(rule.id);
    if (existing) {
      ruleMap.set(rule.id, {
        ...existing,
        ...rule,
        applyScope: scenarioId
          ? ensureScenarioIncluded(existing.applyScope, scenarioId)
          : existing.applyScope ?? rule.applyScope,
      });
      return;
    }
    ruleMap.set(rule.id, {
      ...rule,
      applyScope: scenarioId
        ? { scope: "include", scenarioIds: [scenarioId] }
        : rule.applyScope ?? { scope: "all" },
    });
  };

  rules?.forEach((rule) => upsertRule(rule));

  scenarios.forEach((scenario) => {
    const legacyRules = (scenario as LegacyScenario).budgetRules ?? [];
    legacyRules.forEach((rule) => upsertRule(rule, scenario.id));
  });

  return Array.from(ruleMap.values());
};

const cloneEventRefs = (eventRefs?: ScenarioEventRef[]) =>
  eventRefs?.map((ref) => ({
    ...ref,
    highlighted: ref.highlighted ?? false,
    overrides: ref.overrides ? { ...ref.overrides } : undefined,
  }));

const cloneMembers = (members?: ScenarioMember[]) =>
  members?.map((member) => ({
    ...member,
    applyScope: member.applyScope ? { ...member.applyScope } : undefined,
    milestones: member.milestones
      ? member.milestones.map((milestone) => ({
          ...milestone,
          applyScope: milestone.applyScope ? { ...milestone.applyScope } : undefined,
        }))
      : undefined,
  }));

const cloneBudgetRules = (rules?: BudgetRule[]) =>
  rules?.map((rule) => ({
    ...rule,
    ageBand: { ...rule.ageBand },
    applyScope: rule.applyScope ? { ...rule.applyScope } : undefined,
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

const cloneSnapshots = (snapshots?: ProjectionSnapshot[]) =>
  snapshots?.map((snapshot) => ({ ...snapshot }));

const initialEventLibrary: EventDefinition[] = [];

const initialScenarios: Scenario[] = [];

const ensureHomePositionId = (home: HomePosition | HomePositionDraft): HomePositionDraft => ({
  id: "id" in home ? home.id : createHomePositionId(),
  name: home.name,
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

type LegacyInsurancePosition = {
  id?: string;
  insuranceType?: string;
  premiumMode?: "monthly" | "annual";
  premiumAmount?: number;
  hasCashValue?: boolean;
  cashValueAsOf?: number;
  cashValueAnnualGrowthPct?: number;
};

const isLegacyInsurancePosition = (
  insurance: InsurancePosition | LegacyInsurancePosition
): insurance is LegacyInsurancePosition =>
  "premiumAmount" in insurance || "insuranceType" in insurance || "premiumMode" in insurance;

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const resolveDefaultStartMonth = (baseMonth?: string | null) =>
  baseMonth && isValidMonthStr(baseMonth) ? baseMonth : getCurrentMonth();

const normalizeInsurancePosition = (
  insurance: InsurancePosition | LegacyInsurancePosition,
  baseMonth?: string | null
): InsurancePositionDraft => {
  const id = "id" in insurance ? insurance.id : undefined;
  if (isLegacyInsurancePosition(insurance)) {
    const premiumAmount = insurance.premiumAmount ?? 0;
    const premiumMonthly =
      insurance.premiumMode === "annual" ? premiumAmount / 12 : premiumAmount;
    return {
      id: id ?? createInsurancePositionId(),
      name: insurance.insuranceType ?? "",
      enabled: true,
      kind: insurance.hasCashValue ? "savings" : "protection",
      startMonth: resolveDefaultStartMonth(baseMonth),
      premiumMonthly,
      initialCashValue: insurance.cashValueAsOf,
      expectedAnnualReturnPct: insurance.cashValueAnnualGrowthPct,
    };
  }

  return {
    ...insurance,
    id: id ?? createInsurancePositionId(),
    name: insurance.name ?? "",
    enabled: insurance.enabled ?? true,
    kind: insurance.kind ?? "protection",
    startMonth: insurance.startMonth ?? resolveDefaultStartMonth(baseMonth),
  };
};

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
  insurance: InsurancePosition | LegacyInsurancePosition,
  baseMonth?: string | null
): InsurancePositionDraft => normalizeInsurancePosition(insurance, baseMonth);

const ensureCashBucketPositionId = (
  bucket: CashBucketPosition
): CashBucketPositionDraft => ({
  ...bucket,
  id: bucket.id ?? createCashBucketPositionId(),
});

const cloneSmartInvestPolicy = (
  policy: SmartInvestPolicy
): SmartInvestPolicy => ({
  ...policy,
  reserve: { ...policy.reserve },
  contribution: { ...policy.contribution },
  allocation: policy.allocation.map((entry) => ({
    ...entry,
  })),
  allocationProfiles: policy.allocationProfiles?.map((profile) => ({
    ...profile,
    allocation: profile.allocation.map((entry) => ({ ...entry })),
  })),
  withdrawal: { ...policy.withdrawal },
});

const cloneHomePosition = (home: HomePositionDraft): HomePositionDraft =>
  ensureHomePositionId({
    ...home,
    id: createHomePositionId(),
    existing: home.existing ? { ...home.existing } : undefined,
    rental: home.rental ? { ...home.rental } : undefined,
  });

const cloneCarPosition = (car: CarPositionDraft): CarPositionDraft =>
  ensureCarPositionId({
    ...car,
    id: createCarPositionId(),
    loan: car.loan ? { ...car.loan } : undefined,
  });

const cloneInvestmentPosition = (
  investment: InvestmentPositionDraft
): InvestmentPositionDraft =>
  ensureInvestmentPositionId({
    ...investment,
    id: createInvestmentPositionId(),
  });

const cloneLoanPosition = (loan: LoanPositionDraft): LoanPositionDraft =>
  ensureLoanPositionId({
    ...loan,
    id: createLoanPositionId(),
  });

const cloneInsurancePosition = (
  insurance: InsurancePositionDraft,
  baseMonth?: string | null
): InsurancePositionDraft =>
  ensureInsurancePositionId(
    {
      ...insurance,
      id: createInsurancePositionId(),
    },
    baseMonth
  );

const normalizeScenarioPositions = (
  positions?: ScenarioPositions,
  baseMonth?: string | null
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
      ? positions.insurances.map((insurance) =>
          ensureInsurancePositionId(insurance, baseMonth)
        )
      : positions.insurances,
    loans: positions.loans ? positions.loans.map(ensureLoanPositionId) : positions.loans,
    cars: positions.cars ? positions.cars.map(ensureCarPositionId) : positions.cars,
    cashBuckets: positions.cashBuckets
      ? positions.cashBuckets.map(ensureCashBucketPositionId)
      : positions.cashBuckets,
  };
};

const hasScenarioPositions = (positions?: ScenarioPositions) =>
  Boolean(
    positions?.home ||
      (positions?.homes && positions.homes.length > 0) ||
      (positions?.investments && positions.investments.length > 0) ||
      (positions?.insurances && positions.insurances.length > 0) ||
      (positions?.loans && positions.loans.length > 0) ||
      (positions?.cars && positions.cars.length > 0) ||
      (positions?.cashBuckets && positions.cashBuckets.length > 0)
  );

const shouldAutoCompleteOnboarding = (scenario: Scenario) => {
  if (scenario.clientComputed?.onboardingCompleted !== undefined) {
    return false;
  }

  const hasAssumptions = Boolean(scenario.assumptions?.baseMonth);
  const hasEvents = (scenario.eventRefs ?? []).length > 0;
  const hasPositions = hasScenarioPositions(scenario.positions);

  return hasAssumptions && (hasEvents || hasPositions);
};

type LegacyScenario = Scenario & {
  members?: ScenarioMember[];
  budgetRules?: BudgetRule[];
};

export const normalizeScenario = (scenario: LegacyScenario): Scenario => {
  const normalizedPositions = normalizeScenarioPositions(
    scenario.positions,
    scenario.assumptions?.baseMonth
  );
  const normalizedEventRefs = cloneEventRefs(scenario.eventRefs) ?? [];
  const normalizedClientComputed = cloneClientComputed(scenario.clientComputed);
  const normalizedSnapshots = cloneSnapshots(scenario.snapshots);
  const normalizedPlans = clonePlans(scenario.plans);
  const normalizedAssumptions = {
    ...defaultAssumptions,
    ...scenario.assumptions,
  };
  const nextClientComputed = shouldAutoCompleteOnboarding(scenario)
    ? { ...(normalizedClientComputed ?? {}), onboardingCompleted: true }
    : normalizedClientComputed;

  if (!normalizedPositions) {
    return {
      ...scenario,
      assumptions: normalizedAssumptions,
      eventRefs: normalizedEventRefs,
      clientComputed: nextClientComputed,
      snapshots: normalizedSnapshots,
      plans: normalizedPlans,
      version: scenario.version ?? defaultScenarioVersion,
    };
  }

  return {
    ...scenario,
    assumptions: normalizedAssumptions,
    positions: normalizedPositions,
    eventRefs: normalizedEventRefs,
    clientComputed: nextClientComputed,
    snapshots: normalizedSnapshots,
    plans: normalizedPlans,
    version: scenario.version ?? defaultScenarioVersion,
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

export const resetAppState = () => {
  const state = useScenarioStore.getState();
  useScenarioStore.setState({
    scenarios: normalizeScenarioList(state.scenarios),
    eventLibrary: state.eventLibrary.map((event) => ({
      ...event,
      rule: { ...event.rule },
    })),
    activeScenarioId: state.activeScenarioId,
    appSettings: { ...state.appSettings },
    members: cloneMembers(state.members) ?? [],
    budgetRules: cloneBudgetRules(state.budgetRules) ?? [],
  });
};

export const resetAllLocalData = () => {
  useScenarioStore.setState({
    scenarios: [],
    eventLibrary: [],
    activeScenarioId: "",
    appSettings: { ...defaultAppSettings },
    members: normalizeMembers(),
    budgetRules: [],
  });
};

export const resetScenarioStore = () => {
  clearLocalData();
  resetAllLocalData();
};

export const useScenarioStore = create<ScenarioStoreState>((set, get) => ({
  scenarios: normalizeScenarioList(initialScenarios),
  eventLibrary: initialEventLibrary,
  activeScenarioId: initialScenarios[0]?.id ?? "",
  appSettings: { ...defaultAppSettings },
  members: normalizeMembers(),
  budgetRules: [],
  didHydrate: false,
  isHydrating: false,
  setHydrationState: (patch) => {
    set((state) => ({
      didHydrate: patch.didHydrate ?? state.didHydrate,
      isHydrating: patch.isHydrating ?? state.isHydrating,
    }));
  },
  createScenario: (name, options) => {
    const { globalHorizonMonths, globalBaseMonth } = get().appSettings;
    const newScenario: Scenario = {
      id: createScenarioId(),
      name,
      baseCurrency: options?.baseCurrency ?? defaultCurrency,
      updatedAt: now(),
      version: defaultScenarioVersion,
      kpis: { ...defaultKpis },
      assumptions: {
        ...defaultAssumptions,
        horizonMonths: globalHorizonMonths,
        baseMonth: globalBaseMonth ?? defaultAssumptions.baseMonth,
      },
      eventRefs: [],
      snapshots: [],
      plans: [],
      clientComputed:
        options?.onboardingCompleted !== undefined
          ? { onboardingCompleted: options.onboardingCompleted }
          : undefined,
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
      version: defaultScenarioVersion,
      kpis: { ...source.kpis },
      assumptions: { ...source.assumptions },
      eventRefs: cloneEventRefs(source.eventRefs),
      positions: clonePositions(source.positions),
      clientComputed: cloneClientComputed(source.clientComputed),
      snapshots: cloneSnapshots(source.snapshots),
      plans: [],
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
        activeScenarioId: remaining.length > 0 ? nextActiveId : "",
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
              version: bumpScenarioVersion(scenario),
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
              version: bumpScenarioVersion(scenario),
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
          highlighted: false,
          overrides: overrides ? { ...overrides } : undefined,
        };
        return {
          ...scenario,
          eventRefs: [...existingRefs, nextRef],
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
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
              version: bumpScenarioVersion(scenario),
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
          version: bumpScenarioVersion(scenario),
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
              version: bumpScenarioVersion(scenario),
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
  createMember: (member) => {
    set((state) => ({
      members: [...state.members, normalizeMembers([member])[0]],
    }));
  },
  updateMember: (memberId, patch) => {
    set((state) => ({
      members: state.members.map((member) =>
        member.id === memberId
          ? {
              ...member,
              ...patch,
              milestones: patch.milestones ?? member.milestones,
            }
          : member
      ),
    }));
  },
  deleteMember: (memberId) => {
    set((state) => ({
      members: state.members.filter((member) => member.id !== memberId),
      budgetRules: state.budgetRules.map((rule) =>
        rule.memberId === memberId ? { ...rule, memberId: undefined } : rule
      ),
      eventLibrary: state.eventLibrary.map((definition) =>
        definition.memberId === memberId
          ? { ...definition, memberId: undefined }
          : definition
      ),
    }));
  },
  setMemberApplyScope: (memberId, applyScope) => {
    set((state) => ({
      members: state.members.map((member) =>
        member.id === memberId ? { ...member, applyScope } : member
      ),
    }));
  },
  createBudgetRule: (rule) => {
    set((state) => ({
      budgetRules: [...state.budgetRules, normalizeBudgetRules([rule])[0]],
    }));
  },
  updateBudgetRule: (ruleId, patch) => {
    set((state) => ({
      budgetRules: state.budgetRules.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              ...patch,
              ageBand: patch.ageBand ? { ...patch.ageBand } : { ...rule.ageBand },
            }
          : rule
      ),
    }));
  },
  removeBudgetRule: (ruleId) => {
    set((state) => ({
      budgetRules: state.budgetRules.filter((rule) => rule.id !== ruleId),
    }));
  },
  setScenarioPositions: (id, positions) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const nextPositions = normalizeScenarioPositions(
          positions,
          scenario.assumptions.baseMonth
        );
        const nextHomes = nextPositions?.homes ?? [];
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
          positions: nextPositions,
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
        };
      }),
    }));
  },
  addHomePosition: (id, home) => {
    const nextHome = ensureHomePositionId(home);
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              positions: normalizeScenarioPositions(
                {
                  ...(scenario.positions ?? {}),
                  homes: [...(scenario.positions?.homes ?? []), nextHome],
                },
                scenario.assumptions.baseMonth
              ),
              updatedAt: now(),
              version: bumpScenarioVersion(scenario),
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
          positions: normalizeScenarioPositions(
            {
              ...(scenario.positions ?? {}),
              homes: nextHomes,
            },
            scenario.assumptions.baseMonth
          ),
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
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
          positions: normalizeScenarioPositions(
            nextPositions,
            scenario.assumptions.baseMonth
          ),
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
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
              positions: normalizeScenarioPositions(
                {
                  ...(scenario.positions ?? {}),
                  cars: [...(scenario.positions?.cars ?? []), nextCar],
                },
                scenario.assumptions.baseMonth
              ),
              updatedAt: now(),
              version: bumpScenarioVersion(scenario),
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
          positions: normalizeScenarioPositions(
            {
              ...(scenario.positions ?? {}),
              cars: nextCars,
            },
            scenario.assumptions.baseMonth
          ),
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
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
          positions: normalizeScenarioPositions(
            {
              ...(scenario.positions ?? {}),
              cars: nextCars,
            },
            scenario.assumptions.baseMonth
          ),
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
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
              positions: normalizeScenarioPositions(
                {
                  ...(scenario.positions ?? {}),
                  investments: [
                    ...(scenario.positions?.investments ?? []),
                    nextInvestment,
                  ],
                },
                scenario.assumptions.baseMonth
              ),
              updatedAt: now(),
              version: bumpScenarioVersion(scenario),
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
          positions: normalizeScenarioPositions(
            {
              ...(scenario.positions ?? {}),
              investments: nextInvestments,
            },
            scenario.assumptions.baseMonth
          ),
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
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
          positions: normalizeScenarioPositions(
            {
              ...(scenario.positions ?? {}),
              investments: nextInvestments,
            },
            scenario.assumptions.baseMonth
          ),
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
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
              positions: normalizeScenarioPositions(
                {
                  ...(scenario.positions ?? {}),
                  loans: [...(scenario.positions?.loans ?? []), nextLoan],
                },
                scenario.assumptions.baseMonth
              ),
              updatedAt: now(),
              version: bumpScenarioVersion(scenario),
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
          positions: normalizeScenarioPositions(
            {
              ...(scenario.positions ?? {}),
              loans: nextLoans,
            },
            scenario.assumptions.baseMonth
          ),
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
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
          positions: normalizeScenarioPositions(
            {
              ...(scenario.positions ?? {}),
              loans: nextLoans,
            },
            scenario.assumptions.baseMonth
          ),
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
        };
      }),
    }));
  },
  addInsurancePosition: (id, insurance) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              positions: normalizeScenarioPositions(
                {
                  ...(scenario.positions ?? {}),
                  insurances: [
                    ...(scenario.positions?.insurances ?? []),
                    ensureInsurancePositionId(insurance, scenario.assumptions.baseMonth),
                  ],
                },
                scenario.assumptions.baseMonth
              ),
              updatedAt: now(),
              version: bumpScenarioVersion(scenario),
            }
          : scenario
      ),
    }));
  },
  updateInsurancePosition: (id, insurance) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }

        const nextInsurance = ensureInsurancePositionId(
          insurance,
          scenario.assumptions.baseMonth
        );
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
          positions: normalizeScenarioPositions(
            {
              ...(scenario.positions ?? {}),
              insurances: nextInsurances,
            },
            scenario.assumptions.baseMonth
          ),
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
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
          positions: normalizeScenarioPositions(
            {
              ...(scenario.positions ?? {}),
              insurances: nextInsurances,
            },
            scenario.assumptions.baseMonth
          ),
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
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
              positions: normalizeScenarioPositions(
                {
                  ...(scenario.positions ?? {}),
                  cashBuckets: [
                    ...(scenario.positions?.cashBuckets ?? []),
                    nextBucket,
                  ],
                },
                scenario.assumptions.baseMonth
              ),
              updatedAt: now(),
              version: bumpScenarioVersion(scenario),
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
          positions: normalizeScenarioPositions(
            {
              ...(scenario.positions ?? {}),
              cashBuckets: nextBuckets,
            },
            scenario.assumptions.baseMonth
          ),
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
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
          positions: normalizeScenarioPositions(
            {
              ...(scenario.positions ?? {}),
              cashBuckets: nextBuckets,
            },
            scenario.assumptions.baseMonth
          ),
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
        };
      }),
    }));
  },
  copyPositionToScenarios: (sourceScenarioId, type, positionId, scenarioIds) => {
    set((state) => {
      const sourceScenario = state.scenarios.find(
        (scenario) => scenario.id === sourceScenarioId
      );
      if (!sourceScenario) {
        return state;
      }

      const sourcePositions = sourceScenario.positions ?? {};
      const sourcePosition =
        type === "home"
          ? sourcePositions.homes?.find((entry) => entry.id === positionId)
          : type === "car"
            ? sourcePositions.cars?.find((entry) => entry.id === positionId)
            : type === "investment"
              ? sourcePositions.investments?.find((entry) => entry.id === positionId)
              : type === "insurance"
                ? sourcePositions.insurances?.find((entry) => entry.id === positionId)
                : sourcePositions.loans?.find((entry) => entry.id === positionId);

      if (!sourcePosition) {
        return state;
      }

      const updatedScenarios = state.scenarios.map((scenario) => {
        if (!scenarioIds.includes(scenario.id)) {
          return scenario;
        }
        const nextPositions: ScenarioPositions = {
          ...(scenario.positions ?? {}),
        };

        if (type === "home") {
          const nextHome = cloneHomePosition(sourcePosition as HomePositionDraft);
          nextPositions.homes = [...(scenario.positions?.homes ?? []), nextHome];
        } else if (type === "car") {
          const nextCar = cloneCarPosition(sourcePosition as CarPositionDraft);
          nextPositions.cars = [...(scenario.positions?.cars ?? []), nextCar];
        } else if (type === "investment") {
          const nextInvestment = cloneInvestmentPosition(
            sourcePosition as InvestmentPositionDraft
          );
          nextPositions.investments = [
            ...(scenario.positions?.investments ?? []),
            nextInvestment,
          ];
        } else if (type === "insurance") {
          const nextInsurance = cloneInsurancePosition(
            sourcePosition as InsurancePositionDraft,
            scenario.assumptions.baseMonth
          );
          nextPositions.insurances = [
            ...(scenario.positions?.insurances ?? []),
            nextInsurance,
          ];
        } else if (type === "loan") {
          const nextLoan = cloneLoanPosition(sourcePosition as LoanPositionDraft);
          nextPositions.loans = [...(scenario.positions?.loans ?? []), nextLoan];
        }

        return {
          ...scenario,
          positions: normalizeScenarioPositions(
            nextPositions,
            scenario.assumptions.baseMonth
          ),
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
        };
      });

      return { ...state, scenarios: updatedScenarios };
    });
  },
  copySmartInvestToScenarios: (sourceScenarioId, scenarioIds) => {
    set((state) => {
      const sourceScenario = state.scenarios.find(
        (scenario) => scenario.id === sourceScenarioId
      );
      const sourcePolicy = sourceScenario?.assumptions.smartInvest;
      if (!sourcePolicy) {
        return state;
      }

      const updatedScenarios = state.scenarios.map((scenario) => {
        if (!scenarioIds.includes(scenario.id)) {
          return scenario;
        }
        return {
          ...scenario,
          assumptions: {
            ...scenario.assumptions,
            smartInvest: cloneSmartInvestPolicy(sourcePolicy),
          },
          updatedAt: now(),
          version: bumpScenarioVersion(scenario),
        };
      });

      return { ...state, scenarios: updatedScenarios };
    });
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
          version: bumpScenarioVersion(scenario),
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
  skipOnboardingForScenario: (id) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              clientComputed: { ...(scenario.clientComputed ?? {}), onboardingCompleted: true },
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
    set((state) => {
      const currentGlobalHorizon = state.appSettings.globalHorizonMonths;
      const nextGlobalHorizon = Object.prototype.hasOwnProperty.call(
        patch,
        "horizonMonths"
      )
        ? typeof patch.horizonMonths === "number"
          ? clamp(patch.horizonMonths, horizonRange.min, horizonRange.max)
          : currentGlobalHorizon
        : currentGlobalHorizon;

      const scenarios = state.scenarios.map((scenario) => {
        const horizonChanged =
          Object.prototype.hasOwnProperty.call(patch, "horizonMonths") &&
          nextGlobalHorizon !== scenario.assumptions.horizonMonths;
        const nextAssumptions = { ...scenario.assumptions };
        let didChange = false;

        if (Object.prototype.hasOwnProperty.call(patch, "horizonMonths")) {
          nextAssumptions.horizonMonths = nextGlobalHorizon;
        }

        if (scenario.id === id) {
          if (Object.prototype.hasOwnProperty.call(patch, "initialCash")) {
            const cash =
              typeof patch.initialCash === "number"
                ? Math.max(0, patch.initialCash)
                : scenario.assumptions.initialCash;
            nextAssumptions.initialCash = cash;
            if (cash !== scenario.assumptions.initialCash) {
              didChange = true;
            }
          }

          if (Object.prototype.hasOwnProperty.call(patch, "baseMonth")) {
            const baseMonth = patch.baseMonth;
            if (baseMonth === null) {
              nextAssumptions.baseMonth = null;
            } else if (typeof baseMonth === "string" && isValidBaseMonth(baseMonth)) {
              nextAssumptions.baseMonth = baseMonth;
            }
            if (nextAssumptions.baseMonth !== scenario.assumptions.baseMonth) {
              didChange = true;
            }
          }

          if (Object.prototype.hasOwnProperty.call(patch, "inflationRate")) {
            nextAssumptions.inflationRate = patch.inflationRate;
            if (patch.inflationRate !== scenario.assumptions.inflationRate) {
              didChange = true;
            }
          }

          if (Object.prototype.hasOwnProperty.call(patch, "salaryGrowthRate")) {
            nextAssumptions.salaryGrowthRate = patch.salaryGrowthRate;
            if (patch.salaryGrowthRate !== scenario.assumptions.salaryGrowthRate) {
              didChange = true;
            }
          }

          if (Object.prototype.hasOwnProperty.call(patch, "emergencyFundMonths")) {
            nextAssumptions.emergencyFundMonths = patch.emergencyFundMonths;
            if (patch.emergencyFundMonths !== scenario.assumptions.emergencyFundMonths) {
              didChange = true;
            }
          }

          if (
            Object.prototype.hasOwnProperty.call(
              patch,
              "includeBudgetRulesInProjection"
            )
          ) {
            nextAssumptions.includeBudgetRulesInProjection =
              patch.includeBudgetRulesInProjection ?? true;
            if (
              nextAssumptions.includeBudgetRulesInProjection !==
              scenario.assumptions.includeBudgetRulesInProjection
            ) {
              didChange = true;
            }
          }

          if (Object.prototype.hasOwnProperty.call(patch, "smartInvest")) {
            nextAssumptions.smartInvest = patch.smartInvest ?? undefined;
            if (nextAssumptions.smartInvest !== scenario.assumptions.smartInvest) {
              didChange = true;
            }
          }
        }

        return scenario.id === id || horizonChanged
          ? {
              ...scenario,
              assumptions: nextAssumptions,
              updatedAt: scenario.id === id || horizonChanged ? now() : scenario.updatedAt,
              version:
                scenario.id === id
                  ? didChange || horizonChanged
                    ? bumpScenarioVersion(scenario)
                    : ensureScenarioVersion(scenario)
                  : horizonChanged
                    ? bumpScenarioVersion(scenario)
                    : ensureScenarioVersion(scenario),
            }
          : scenario;
      });

      return {
        ...state,
        scenarios,
        appSettings: {
          ...state.appSettings,
          globalHorizonMonths: nextGlobalHorizon,
        },
      };
    });
  },
  setScenarioHorizonMonths: (_id, horizonMonths) => {
    get().setGlobalHorizonMonths(horizonMonths);
  },
  setGlobalHorizonMonths: (horizonMonths) => {
    set((state) => {
      const nextGlobalHorizon = clamp(horizonMonths, horizonRange.min, horizonRange.max);
      return {
        ...state,
        appSettings: {
          ...state.appSettings,
          globalHorizonMonths: nextGlobalHorizon,
        },
        scenarios: state.scenarios.map((scenario) => ({
          ...scenario,
          assumptions: {
            ...scenario.assumptions,
            horizonMonths: nextGlobalHorizon,
          },
        })),
      };
    });
  },
  setGlobalBaseMonth: (baseMonth) => {
    set((state) => ({
      ...state,
      appSettings: {
        ...state.appSettings,
        globalBaseMonth: baseMonth,
      },
      scenarios: state.scenarios.map((scenario) => ({
        ...scenario,
        assumptions: {
          ...scenario.assumptions,
          baseMonth,
        },
      })),
    }));
  },
  setAnnualInflationPct: (value) => {
    set((state) => ({
      ...state,
      appSettings: {
        ...state.appSettings,
        annualInflationPct: value,
      },
    }));
  },
  setViewMode: (value) => {
    set((state) => ({
      ...state,
      appSettings: {
        ...state.appSettings,
        viewMode: value,
      },
    }));
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
  updateSmartInvest: (id, policy) => {
    get().updateScenarioAssumptions(id, { smartInvest: policy ?? undefined });
  },
  replaceScenario: (scenario) => {
    const normalizedScenario = normalizeScenario(scenario);
    const globalHorizonMonths = get().appSettings.globalHorizonMonths;
    set((state) => {
      const exists = state.scenarios.some((entry) => entry.id === normalizedScenario.id);
      const scenarios = exists
        ? state.scenarios.map((entry) =>
            entry.id === normalizedScenario.id
              ? {
                  ...normalizedScenario,
                  assumptions: {
                    ...normalizedScenario.assumptions,
                    horizonMonths: globalHorizonMonths,
                  },
                }
              : entry
          )
        : [
            {
              ...normalizedScenario,
              assumptions: {
                ...normalizedScenario.assumptions,
                horizonMonths: globalHorizonMonths,
              },
            },
            ...state.scenarios,
          ];

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
    const globalHorizonMonths = get().appSettings.globalHorizonMonths;
    const normalizedScenarios = normalizeScenarioList(scenarios).map((scenario) => ({
      ...scenario,
      assumptions: {
        ...scenario.assumptions,
        horizonMonths: globalHorizonMonths,
      },
    }));
    set(() => ({
      scenarios: normalizedScenarios,
      activeScenarioId: normalizedScenarios[0]?.id ?? "",
    }));
  },
  addSnapshot: (scenarioId, snapshot) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === scenarioId
          ? {
              ...scenario,
              snapshots: [...(scenario.snapshots ?? []), { ...snapshot }],
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  removeSnapshot: (scenarioId, snapshotId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === scenarioId
          ? {
              ...scenario,
              snapshots: (scenario.snapshots ?? []).filter(
                (snapshot) => snapshot.id !== snapshotId
              ),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  clearSnapshots: (scenarioId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === scenarioId
          ? {
              ...scenario,
              snapshots: [],
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  upsertScenarioPlan: (scenarioId, plan) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== scenarioId) {
          return scenario;
        }
        const existingPlans = scenario.plans ?? [];
        const hasMatch = existingPlans.some((entry) => entry.id === plan.id);
        const nextPlans = hasMatch
          ? existingPlans.map((entry) => (entry.id === plan.id ? plan : entry))
          : [...existingPlans, plan];
        return {
          ...scenario,
          plans: nextPlans,
          updatedAt: now(),
          version: ensureScenarioVersion(scenario),
        };
      }),
    }));
  },
  removeScenarioPlan: (scenarioId, planId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== scenarioId) {
          return scenario;
        }
        return {
          ...scenario,
          plans: (scenario.plans ?? []).filter((plan) => plan.id !== planId),
          updatedAt: now(),
          version: ensureScenarioVersion(scenario),
        };
      }),
    }));
  },
}));
