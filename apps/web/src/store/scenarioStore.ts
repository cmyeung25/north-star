// Shape note: Scenario positions.homes entries originally held price/downPayment/purchaseMonth/annualAppreciationPct/mortgage info (+feesOneTime).
// Added fields: holdingCostMonthly and holdingCostAnnualGrowthPct (percent for UI storage).
// Back-compat: missing holding cost fields default to 0 in adapters/engine.
import { nanoid } from "nanoid";
import { create } from "zustand";
import { defaultCurrency } from "../../lib/i18n";
import type { MoneyItemUpsert } from "../../features/moneyFlow/types";
import type { AssetItemUpsert } from "../../features/assets/types";
import type { LiabilityItemUpsert } from "../../features/liabilities/types";
import type { ApplyScope } from "../domain/applyScope";
import type { EventDefinition, ScenarioEventRef } from "../domain/events/types";
import type {
  ScenarioEvent,
  ScenarioEventDraft,
} from "../domain/scenarioV2/events";
import type { BundleWizardInput } from "../domain/eventTemplates/bundles";
import {
  CashflowEventSchema,
  ScenarioEventSchema,
} from "../domain/scenarioV2/events";
import { normalizeCashflowGrowth } from "../domain/scenarioV2/growthPolicy";
import {
  buildEventDeleteImpact,
  type EventDeleteImpact,
} from "../domain/scenarioV2/eventDeleteImpact";
import {
  compileEventToOps,
} from "../domain/milestoneEvents/compiler";
import {
  buildMilestoneScenarioSnapshot,
} from "../domain/milestoneEvents/snapshot";
import type {
  MilestoneEvent,
  MilestoneEventDraft,
  MilestoneEventCompileResult,
  GeneratedEntitySummary,
} from "../domain/milestoneEvents/types";
import type { Plan, PlanLabMeta } from "../domain/planLab/types";
import type { EventType } from "../features/timeline/schema";
import type { SmartInvestPolicy } from "../domain/smartInvest/types";
import { DEFAULT_ANNUAL_GROWTH_PCT } from "../domain/constants";
import { DEFAULT_GROWTH_MODE, type GrowthMode } from "../domain/growthMode";
import {
  buildEventRuleOverrides,
  type DuplicateCluster,
} from "../domain/events/mergeDuplicates";
import { buildEventLibraryMap, resolveEventRule } from "../domain/events/utils";
import { clearLocalData } from "../persistence/storage";
import { isValidMonthStr } from "../utils/month";
import { buildMonthDateRef } from "../domain/dateRef";
import type { ScenarioSeedPayload } from "../scenarios/scenarioSeeds";
import { buildScenarioDraftFromSeed } from "../scenarios/buildScenarioDraftFromSeed";
import { submitScenarioDraft } from "../domain/scenarioDraft/submitScenarioDraft";

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
  propertyAppreciationPct?: number;
  carDepreciationRatePct?: number;
  cashYieldPct?: number;
  taxInputMode?: "gross" | "net";
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

export type ScenarioGeneratedMetadata = {
  source?: "plan-lab" | "scenario-draft";
  origin?: string;
  ruleId?: string;
  [key: string]: unknown;
};

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
  source?: "manual" | "eventGenerated" | "derived";
  generatedByEventId?: string;
  metadata?: ScenarioGeneratedMetadata;
  generatedBy?: {
    type: "assetCost";
    assetId: string;
    subType: "purchaseFee" | "ongoing";
    key: string;
  } | {
    type: "assetRental";
    assetId: string;
  } | {
    type: "loanPayment";
    liabilityId: string;
  };
  linkedAssetId?: string;
  linkedLiabilityId?: string;
};

export type ExistingHomeDetails = {
  asOfMonth: string;
  marketValue: number;
  mortgageBalance: number;
  remainingTermMonths: number;
  annualRatePct: number;
};

export type RentalDetails = {
  isRented?: boolean;
  rentMonthly: number;
  rentStartMonth: string;
  rentEndMonth?: string | null;
  rentAnnualGrowthPct?: number;
  rentGrowthMode?: GrowthMode;
  vacancyRatePct?: number;
};

export type AssetPurchaseFee = {
  id: string;
  label: string;
  amount: number;
  month: string;
};

export type AssetOngoingCost = {
  key: string;
  enabled: boolean;
  amount: number;
  startMonth: string;
};

export type HomePosition = {
  name?: string;
  ownerMemberId?: string;
  usage?: HomeUsage;
  mode?: HomeMode;
  purchasePrice?: number;
  mortgageBaseValue?: number;
  downPayment?: number;
  purchaseMonth?: string;
  annualAppreciationPct: number;
  appreciationMode?: GrowthMode;
  mortgageRatePct?: number;
  mortgageTermYears?: number;
  feesOneTime?: number;
  holdingCostMonthly?: number;
  holdingCostAnnualGrowthPct?: number;
  sellMonth?: string;
  sellPriceOverride?: number;
  sellFeesOneTime?: number;
  purchaseFees?: AssetPurchaseFee[];
  ongoingCosts?: AssetOngoingCost[];
  notes?: string;
  existing?: ExistingHomeDetails;
  rental?: RentalDetails;
  source?: "manual" | "eventGenerated" | "derived";
  generatedByEventId?: string;
  metadata?: ScenarioGeneratedMetadata;
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
  source?: "manual" | "eventGenerated" | "derived";
  generatedByEventId?: string;
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
  source?: "manual" | "eventGenerated" | "derived";
  generatedByEventId?: string;
};

export type LoanPosition = {
  id?: string;
  name?: string;
  ownerMemberId?: string;
  startMonth: string;
  loanType?: "mortgage" | "loan" | "carLoan" | "other";
  principal: number;
  annualInterestRatePct: number;
  termYears: number;
  monthlyPayment?: number;
  paymentMethod?: "amortization" | "manual";
  feesOneTime?: number;
  purchasePrice?: number;
  downPaymentPercent?: number;
  generatePaymentExpense?: boolean;
  linkedAssetId?: string;
  notes?: string;
  source?: "manual" | "eventGenerated" | "derived";
  generatedByEventId?: string;
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
  depreciationMode?: GrowthMode;
  holdingCostMonthly: number;
  holdingCostAnnualGrowthPct: number;
  purchaseFees?: AssetPurchaseFee[];
  ongoingCosts?: AssetOngoingCost[];
  loan?: CarLoanDetails;
  sellMonth?: string;
  sellPriceOverride?: number;
  sellFeesOneTime?: number;
  notes?: string;
  source?: "manual" | "eventGenerated" | "derived";
  generatedByEventId?: string;
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

export type ScenarioAssetKind =
  | "home"
  | "investment"
  | "cash"
  | "car"
  | "policy"
  | "other";

export type ScenarioEntityTemplate =
  | "housing_mortgage"
  | "loan"
  | "insurance_savings";

export type ScenarioAsset = {
  id: string;
  kind: ScenarioAssetKind;
  label?: string;
  ownerMemberId?: string;
  notes?: string;
  currentValue?: number;
  currency?: string;
  startMonth?: string;
  source?: "manual" | "eventGenerated";
  createdByEventId?: string;
  createdByTemplate?: ScenarioEntityTemplate;
  depreciationSource?: "carDepreciation";
  metadata?: ScenarioGeneratedMetadata;
};

export type ScenarioLiabilityKind =
  | "mortgage"
  | "loan"
  | "carLoan"
  | "credit"
  | "other";

export type ScenarioLiability = {
  id: string;
  kind: ScenarioLiabilityKind;
  label?: string;
  ownerMemberId?: string;
  notes?: string;
  principalOutstanding?: number;
  annualInterestRatePct?: number;
  termYears?: number;
  startMonth?: string;
  source?: "manual" | "eventGenerated";
  createdByEventId?: string;
  createdByTemplate?: ScenarioEntityTemplate;
  metadata?: ScenarioGeneratedMetadata;
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
  schemaVersion?: number;
  onboarded?: boolean;
  onboardedAt?: string;
  lastSavedAt?: string;
  isSeeded?: boolean;
  skipOnboarding?: boolean;
  planLab?: PlanLabMeta;
};

export type ScenarioClientComputed = {
  onboardingPersona?: OnboardingPersona;
  onboardingCompleted?: boolean;
};

export type BundleInstanceRecord = {
  id: string;
  wizardInput: BundleWizardInput;
  updatedAt: number;
};

export type Scenario = {
  id: string;
  name: string;
  baseCurrency: string;
  updatedAt: number;
  version?: number;
  kpis: ScenarioKpis;
  assumptions: ScenarioAssumptions;
  members?: ScenarioMember[];
  assets?: ScenarioAsset[];
  liabilities?: ScenarioLiability[];
  events?: ScenarioEvent[];
  eventRefs?: ScenarioEventRef[];
  milestoneEvents?: MilestoneEvent[];
  positions?: ScenarioPositions;
  clientComputed?: ScenarioClientComputed;
  snapshots?: ProjectionSnapshot[];
  plans?: Plan[];
  bundleInstances?: BundleInstanceRecord[];
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
  createScenarioFromSeed: (name: string, seed: ScenarioSeedPayload) => Scenario | null;
  renameScenario: (id: string, name: string) => void;
  duplicateScenario: (id: string) => Scenario | null;
  deleteScenario: (id: string) => void;
  setActiveScenario: (id: string) => void;
  updateScenarioKpis: (id: string, kpis: ScenarioKpis) => void;
  upsertScenarioAssets: (id: string, assets: ScenarioAsset[]) => void;
  upsertScenarioLiabilities: (id: string, liabilities: ScenarioLiability[]) => void;
  setScenarioAssets: (id: string, assets: ScenarioAsset[]) => void;
  setScenarioLiabilities: (id: string, liabilities: ScenarioLiability[]) => void;
  setScenarioMembers: (id: string, members: ScenarioMember[]) => void;
  setScenarioEvents: (id: string, events: ScenarioEvent[]) => void;
  addEvent: (
    event: ScenarioEventDraft,
    scenarioId?: string
  ) => { ok: boolean; event?: ScenarioEvent; error?: string };
  replaceBundleEvents: (
    bundleInstanceId: string,
    events: ScenarioEventDraft[],
    scenarioId?: string
  ) => { ok: boolean; error?: string };
  upsertBundleInstanceRecord: (
    scenarioId: string,
    record: BundleInstanceRecord
  ) => void;
  removeBundleInstanceRecord: (scenarioId: string, bundleInstanceId: string) => void;
  updateEvent: (
    eventId: string,
    patch: Partial<ScenarioEvent>,
    scenarioId?: string
  ) => { ok: boolean; event?: ScenarioEvent; error?: string };
  removeEvent: (
    eventId: string,
    scenarioId?: string,
    options?: { cascade?: boolean }
  ) => { ok: boolean; error?: string; impact?: EventDeleteImpact | null };
  duplicateEvent: (
    eventId: string,
    scenarioId?: string
  ) => { ok: boolean; event?: ScenarioEvent; error?: string };
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
  updateScenarioBaseCurrency: (id: string, baseCurrency: string) => void;
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
  applyMilestoneEvent: (
    scenarioId: string,
    draft: MilestoneEventDraft
  ) => MilestoneEventCompileResult;
  removeMilestoneEvent: (scenarioId: string, eventId: string) => void;
  findGeneratedEntities: (scenarioId: string, eventId: string) => GeneratedEntitySummary;
  cleanupGeneratedEntities: (scenarioId: string, eventId: string) => void;
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

export const selectEvents = (
  state: ScenarioStoreState,
  scenarioId?: string
): ScenarioEvent[] => {
  const resolvedScenarioId = scenarioId ?? state.activeScenarioId;
  const scenario = state.scenarios.find((entry) => entry.id === resolvedScenarioId);
  return scenario?.events ?? [];
};

export const selectEventById = (
  state: ScenarioStoreState,
  eventId: string,
  scenarioId?: string
): ScenarioEvent | null => {
  const resolvedScenarioId = scenarioId ?? state.activeScenarioId;
  const scenario = state.scenarios.find((entry) => entry.id === resolvedScenarioId);
  return scenario?.events?.find((event) => event.id === eventId) ?? null;
};

export const hydrateFromPersistedState = (
  payload: ScenarioStorePersistedState
): ScenarioStorePersistedState => {
  const normalizedScenarios = normalizeScenarioList(payload.scenarios);
  const normalizedEventLibrary = payload.eventLibrary.map((event) => ({
    ...event,
    rule: migrateEventRule(event.rule),
  }));
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
    eventLibrary: normalizedEventLibrary,
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
    eventLibrary: normalizedEventLibrary,
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

const horizonRange = { min: 36, max: 960 };

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
  })) ?? [];

const createScenarioId = () => `scenario-${nanoid(8)}`;
const createScenarioEventId = () => `evt_v2_${nanoid(8)}`;
export const createHomePositionId = () => `home-${nanoid(8)}`;
export const createCarPositionId = () => `car-${nanoid(8)}`;
export const createInvestmentPositionId = () => `investment-${nanoid(8)}`;
export const createLoanPositionId = () => `loan-${nanoid(8)}`;
export const createInsurancePositionId = () => `insurance-${nanoid(8)}`;
export const createCashBucketPositionId = () => `cash-${nanoid(8)}`;
export const createMemberId = () => `member-${nanoid(8)}`;
export const createBudgetRuleId = () => `budget-${nanoid(8)}`;
const createEventDefinitionId = () => `evt_${nanoid(8)}`;

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
    // {
    //   id: createMemberId(),
    //   name: DEFAULT_MEMBER_NAME,
    //   kind: "person",
    //   applyScope: { scope: "all" },
    //   milestones: [],
    // },
  ];
};

const normalizeBudgetRules = (rules?: BudgetRule[]): BudgetRule[] =>
  rules?.map((rule) => ({
    ...rule,
    ageBand: { ...rule.ageBand },
    applyScope: normalizeApplyScope(rule.applyScope),
    source: rule.source ?? "manual",
  })) ?? [];

const normalizeMilestoneEvents = (events?: MilestoneEvent[]): MilestoneEvent[] =>
  events?.map((event) => ({
    ...event,
    createdAt: event.createdAt ?? now(),
    updatedAt: event.updatedAt ?? event.createdAt ?? now(),
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

const buildEventDefinitionFromMoneyItem = (
  item: MoneyItemUpsert,
  baseCurrency: string
): EventDefinition => {
  const nextDefinitionId = createEventDefinitionId();
  const nextTitle = item.notes?.trim() || item.category;
  const nextType = item.category as EventType;
  const growthMode = nextType === "rent" ? DEFAULT_GROWTH_MODE : undefined;
  return {
    id: nextDefinitionId,
    title: nextTitle,
    type: nextType,
    kind: "cashflow",
    rule: {
      mode: "params",
      startMonth: item.cadence === "recurring" ? item.startMonth ?? "" : item.month ?? "",
      endMonth: item.cadence === "recurring" ? item.endMonth ?? null : null,
      monthlyAmount: item.cadence === "recurring" ? item.amount : 0,
      oneTimeAmount: item.cadence === "oneOff" ? item.amount : 0,
      annualGrowthPct: item.cadence === "oneOff" ? 0 : DEFAULT_ANNUAL_GROWTH_PCT,
      growthMode,
    },
    currency: item.currency ?? baseCurrency,
    memberId: item.memberId,
    incomeSubtype: undefined,
    generatedByEventId: item.generatedByEventId,
    source: item.source,
    generatedBy: item.generatedBy,
    linkedAssetId: item.linkedAssetId,
    linkedLiabilityId: item.linkedLiabilityId,
    categoryOverride: item.categoryOverride,
  };
};

const buildBudgetRuleFromMoneyItem = (item: MoneyItemUpsert): BudgetRule => ({
  id: createBudgetRuleId(),
  name: item.notes?.trim() || item.category,
  enabled: true,
  memberId: item.memberId,
  category: item.category as BudgetRule["category"],
  ageBand: { fromYears: 0, toYears: 120 },
  monthlyAmount: item.amount,
  annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
  startMonth: item.startMonth ?? undefined,
  endMonth: item.endMonth ?? undefined,
  applyScope: { scope: "all" },
  source: item.source ?? "eventGenerated",
  generatedByEventId: item.generatedByEventId,
  generatedBy: item.generatedBy,
  linkedAssetId: item.linkedAssetId,
  linkedLiabilityId: item.linkedLiabilityId,
});

const applyAssetItemUpsertToPositions = (
  positions: ScenarioPositions | undefined,
  item: AssetItemUpsert,
  baseMonth: string | null
): ScenarioPositions => {
  const nextPositions = positions ?? {};
  const startMonth = item.startMonth ?? baseMonth ?? "";
  const source = item.source ?? "manual";
  const generatedByEventId = item.generatedByEventId;

  if (item.assetType === "property") {
    const homes = nextPositions.homes ?? [];
    const existing = homes.find((home) => home.id === item.id);
    const nextHome: HomePositionDraft = {
      ...(existing ?? {
        id: createHomePositionId(),
        purchaseMonth: startMonth,
        purchasePrice: item.currentValue ?? 0,
        downPayment: 0,
        annualAppreciationPct: 0,
        appreciationMode: DEFAULT_GROWTH_MODE,
        holdingCostMonthly: 0,
        holdingCostAnnualGrowthPct: 0,
      }),
      id: item.id ?? existing?.id ?? createHomePositionId(),
      name: item.name ?? existing?.name,
      ownerMemberId: item.ownerMemberId ?? existing?.ownerMemberId,
      purchasePrice: item.currentValue ?? existing?.purchasePrice,
      purchaseMonth: startMonth || existing?.purchaseMonth,
      notes: item.notes ?? existing?.notes,
      purchaseFees: item.purchaseFees ?? existing?.purchaseFees,
      ongoingCosts: item.ongoingCosts ?? existing?.ongoingCosts,
      rental: item.rental
        ? {
            isRented: item.rental.isRented,
            rentMonthly: item.rental.rentAmountMonthly,
            rentStartMonth: item.rental.rentStartMonth,
            rentEndMonth: item.rental.rentEndMonth ?? null,
            rentGrowthMode: existing?.rental?.rentGrowthMode ?? DEFAULT_GROWTH_MODE,
          }
        : existing?.rental,
      source,
      generatedByEventId,
    };
    return {
      ...nextPositions,
      homes: existing
        ? homes.map((home) => (home.id === nextHome.id ? nextHome : home))
        : [...homes, nextHome],
    };
  }

  if (item.assetType === "investment") {
    const investments = nextPositions.investments ?? [];
    const existing = investments.find((investment) => investment.id === item.id);
    const nextInvestment: InvestmentPositionDraft = {
      ...(existing ?? {
        id: createInvestmentPositionId(),
        startMonth,
        initialValue: item.currentValue ?? 0,
        assetClass: "fund",
      }),
      id: item.id ?? existing?.id ?? createInvestmentPositionId(),
      name: item.name ?? existing?.name,
      ownerMemberId: item.ownerMemberId ?? existing?.ownerMemberId,
      startMonth: startMonth || existing?.startMonth || "",
      initialValue: item.currentValue ?? existing?.initialValue ?? 0,
      notes: item.notes ?? existing?.notes,
      source,
      generatedByEventId,
    };
    return {
      ...nextPositions,
      investments: existing
        ? investments.map((entry) => (entry.id === nextInvestment.id ? nextInvestment : entry))
        : [...investments, nextInvestment],
    };
  }

  if (item.assetType === "insurance") {
    const insurances = nextPositions.insurances ?? [];
    const existing = insurances.find((insurance) => insurance.id === item.id);
    const nextInsurance: InsurancePositionDraft = {
      ...(existing ?? {
        id: createInsurancePositionId(),
        name: item.name ?? "",
        enabled: true,
        kind: "protection",
        startMonth,
        premiumMonthly: 0,
      }),
      id: item.id ?? existing?.id ?? createInsurancePositionId(),
      name: item.name ?? existing?.name ?? "",
      ownerMemberId: item.ownerMemberId ?? existing?.ownerMemberId,
      startMonth: startMonth || existing?.startMonth || "",
      initialCashValue: item.currentValue ?? existing?.initialCashValue ?? 0,
      notes: item.notes ?? existing?.notes,
      source,
      generatedByEventId,
    };
    return {
      ...nextPositions,
      insurances: existing
        ? insurances.map((entry) => (entry.id === nextInsurance.id ? nextInsurance : entry))
        : [...insurances, nextInsurance],
    };
  }

  const cars = nextPositions.cars ?? [];
  const existing = cars.find((car) => car.id === item.id);
  const nextCar: CarPositionDraft = {
    ...(existing ?? {
      id: createCarPositionId(),
      purchaseMonth: startMonth,
      purchasePrice: item.currentValue ?? 0,
      downPayment: 0,
      annualDepreciationRatePct: 0,
      depreciationMode: DEFAULT_GROWTH_MODE,
      holdingCostMonthly: 0,
      holdingCostAnnualGrowthPct: 0,
    }),
    id: item.id ?? existing?.id ?? createCarPositionId(),
    name: item.name ?? existing?.name,
    ownerMemberId: item.ownerMemberId ?? existing?.ownerMemberId,
    purchaseMonth: startMonth || existing?.purchaseMonth || "",
    purchasePrice: item.currentValue ?? existing?.purchasePrice ?? 0,
    notes: item.notes ?? existing?.notes,
    purchaseFees: item.purchaseFees ?? existing?.purchaseFees,
    ongoingCosts: item.ongoingCosts ?? existing?.ongoingCosts,
    source,
    generatedByEventId,
  };
  return {
    ...nextPositions,
    cars: existing
      ? cars.map((entry) => (entry.id === nextCar.id ? nextCar : entry))
      : [...cars, nextCar],
  };
};

const applyAssetItemRemoveFromPositions = (
  positions: ScenarioPositions | undefined,
  item: AssetItemUpsert
): ScenarioPositions => {
  const nextPositions = positions ?? {};
  switch (item.assetType) {
    case "property":
      return {
        ...nextPositions,
        homes: nextPositions.homes?.filter((home) => home.id !== item.id),
      };
    case "investment":
      return {
        ...nextPositions,
        investments: nextPositions.investments?.filter((investment) => investment.id !== item.id),
      };
    case "insurance":
      return {
        ...nextPositions,
        insurances: nextPositions.insurances?.filter((insurance) => insurance.id !== item.id),
      };
    case "car":
      return {
        ...nextPositions,
        cars: nextPositions.cars?.filter((car) => car.id !== item.id),
      };
    default:
      return nextPositions;
  }
};

const applyLiabilityItemUpsertToPositions = (
  positions: ScenarioPositions | undefined,
  item: LiabilityItemUpsert,
  baseMonth: string | null
): ScenarioPositions => {
  const nextPositions = positions ?? {};
  const loans = nextPositions.loans ?? [];
  const existing = loans.find((loan) => loan.id === item.id);
  const startMonth = item.startMonth ?? baseMonth ?? "";
  const resolvedTermMonths = item.termMonths ?? 12;
  const nextLoan: LoanPositionDraft = {
    ...(existing ?? {
      id: createLoanPositionId(),
      startMonth,
      principal: item.principalOutstanding ?? 0,
      annualInterestRatePct: item.interestRate ?? 0,
      termYears: Math.max(1, Math.round(resolvedTermMonths / 12)),
    }),
    id: item.id ?? existing?.id ?? createLoanPositionId(),
    name: item.name ?? existing?.name,
    startMonth: startMonth || existing?.startMonth || "",
    loanType: item.liabilityType ?? existing?.loanType,
    principal: item.principalOutstanding ?? existing?.principal ?? 0,
    annualInterestRatePct: item.interestRate ?? existing?.annualInterestRatePct ?? 0,
    termYears: Math.max(1, Math.round(resolvedTermMonths / 12)),
    notes: item.notes ?? existing?.notes,
    purchasePrice: item.purchasePrice ?? existing?.purchasePrice,
    downPaymentPercent: item.downPaymentPercent ?? existing?.downPaymentPercent,
    generatePaymentExpense:
      item.generatePaymentExpense ?? existing?.generatePaymentExpense,
    linkedAssetId: item.linkedAssetId ?? existing?.linkedAssetId,
    source: item.source ?? existing?.source,
    generatedByEventId: item.generatedByEventId ?? existing?.generatedByEventId,
  };
  return {
    ...nextPositions,
    loans: existing
      ? loans.map((entry) => (entry.id === nextLoan.id ? nextLoan : entry))
      : [...loans, nextLoan],
  };
};

const applyLiabilityItemRemoveFromPositions = (
  positions: ScenarioPositions | undefined,
  item: LiabilityItemUpsert
): ScenarioPositions => {
  const nextPositions = positions ?? {};
  return {
    ...nextPositions,
    loans: nextPositions.loans?.filter((loan) => loan.id !== item.id),
  };
};

const resolvePropertyMarketValue = (event: ScenarioEvent) => {
  if (event.type !== "housing" || event.kind !== "mortgage") {
    return undefined;
  }
  return typeof event.propertyMarketValue === "number"
    ? event.propertyMarketValue
    : typeof event.purchasePrice === "number"
    ? event.purchasePrice
    : undefined;
};

const resolveMortgageBaseValue = (event: ScenarioEvent) => {
  if (event.type !== "housing" || event.kind !== "mortgage") {
    return undefined;
  }
  return typeof event.mortgageBaseValue === "number"
    ? event.mortgageBaseValue
    : typeof event.purchasePrice === "number"
    ? event.purchasePrice
    : typeof event.propertyMarketValue === "number"
    ? event.propertyMarketValue
    : undefined;
};

const resolveMortgagePrincipal = (event: ScenarioEvent) => {
  if (event.type !== "housing" || event.kind !== "mortgage") {
    return undefined;
  }
  const mortgageBaseValue = resolveMortgageBaseValue(event);
  if (typeof mortgageBaseValue !== "number") {
    return undefined;
  }
  if (event.downPaymentMode === "amount") {
    return Math.max(mortgageBaseValue - (event.downPaymentAmount ?? 0), 0);
  }
  if (event.downPaymentMode === "percent") {
    const downPaymentPct = event.downPaymentPercent ?? 0;
    return Math.max(mortgageBaseValue * (1 - downPaymentPct / 100), 0);
  }
  if (typeof event.downPaymentAmount === "number") {
    return Math.max(mortgageBaseValue - event.downPaymentAmount, 0);
  }
  return mortgageBaseValue;
};

const buildEventGeneratedAssetsForEvent = (
  event: ScenarioEvent
): ScenarioAsset[] => {
  if (event.type === "housing" && event.kind === "mortgage") {
    const currentValue = resolvePropertyMarketValue(event);
    return [
      {
        id: event.propertyAssetId ?? event.id,
        kind: "home" as const,
        label: event.label,
        currentValue,
        source: "eventGenerated" as const,
        createdByEventId: event.id,
        createdByTemplate: "housing_mortgage" as const,
      },
    ];
  }
  if (event.type === "insurance" && event.mode === "detailed") {
    return (event.policies ?? []).flatMap<ScenarioAsset>((policy) =>
      policy.kind === "savings"
        ? [
            {
              id: policy.policyAssetId ?? policy.id,
              kind: "policy" as const,
              label: policy.name ?? event.label,
              currentValue: policy.cashValue,
              source: "eventGenerated" as const,
              createdByEventId: event.id,
              createdByTemplate: "insurance_savings" as const,
            },
          ]
        : []
    );
  }
  return [];
};

const buildEventGeneratedLiabilitiesForEvent = (
  event: ScenarioEvent
): ScenarioLiability[] => {
  if (event.type === "housing" && event.kind === "mortgage") {
    return [
      {
        id: event.mortgageLiabilityId ?? event.id,
        kind: "mortgage" as const,
        label: event.label,
        principalOutstanding: resolveMortgagePrincipal(event),
        annualInterestRatePct: event.mortgageRatePct,
        termYears: event.mortgageTermYears,
        startMonth: event.startMonth,
        source: "eventGenerated" as const,
        createdByEventId: event.id,
        createdByTemplate: "housing_mortgage" as const,
      },
    ];
  }
  if (event.type === "loan") {
    return [
      {
        id: event.liabilityId ?? event.id,
        kind:
          event.loanKind === "car"
            ? "carLoan"
            : event.loanKind === "credit"
            ? "credit"
            : event.loanKind === "personal"
            ? "loan"
            : "other",
        label: event.label,
        principalOutstanding: event.principal,
        annualInterestRatePct: event.annualInterestRatePct,
        termYears: event.termYears,
        startMonth: event.startMonth,
        source: "eventGenerated" as const,
        createdByEventId: event.id,
        createdByTemplate: "loan" as const,
      },
    ];
  }
  return [];
};

const upsertScenarioEntities = <T extends { id: string }>(
  existing: T[],
  incoming: T[]
) => {
  if (incoming.length === 0) {
    return existing;
  }
  const mergedById = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    const current = mergedById.get(item.id);
    mergedById.set(item.id, current ? { ...current, ...item } : item);
  });
  return Array.from(mergedById.values());
};

const upsertEventGeneratedEntities = ({
  existingAssets,
  existingLiabilities,
  event,
}: {
  existingAssets: ScenarioAsset[];
  existingLiabilities: ScenarioLiability[];
  event: ScenarioEvent;
}) => {
  const eventAssets = buildEventGeneratedAssetsForEvent(event);
  const eventLiabilities = buildEventGeneratedLiabilitiesForEvent(event);
  return {
    assets: upsertScenarioEntities(existingAssets, eventAssets),
    liabilities: upsertScenarioEntities(existingLiabilities, eventLiabilities),
  };
};

const collectReferencedEntityIds = (events: ScenarioEvent[]) => {
  const referencedAssetIds = new Set<string>();
  const referencedLiabilityIds = new Set<string>();
  events.forEach((event) => {
    if (event.type === "housing" && event.kind === "mortgage") {
      if (event.propertyAssetId) {
        referencedAssetIds.add(event.propertyAssetId);
      }
      if (event.mortgageLiabilityId) {
        referencedLiabilityIds.add(event.mortgageLiabilityId);
      }
    }
    if (event.type === "insurance" && event.mode === "detailed") {
      (event.policies ?? []).forEach((policy) => {
        if (policy.policyAssetId) {
          referencedAssetIds.add(policy.policyAssetId);
        }
      });
    }
    if (event.type === "loan" && event.liabilityId) {
      referencedLiabilityIds.add(event.liabilityId);
    }
  });
  return { referencedAssetIds, referencedLiabilityIds };
};

const migrateEventRule = (rule: EventDefinition["rule"]): EventDefinition["rule"] => {
  const startAt = rule.startAt ?? buildMonthDateRef(rule.startMonth ?? undefined) ?? undefined;
  const endAt =
    rule.endAt ?? (rule.endMonth === null ? null : buildMonthDateRef(rule.endMonth ?? undefined));
  return {
    ...rule,
    startAt,
    endAt,
  };
};

const migrateEventRuleOverrides = (
  overrides?: ScenarioEventRef["overrides"]
): ScenarioEventRef["overrides"] => {
  if (!overrides) {
    return overrides;
  }
  const startAt =
    overrides.startAt ?? buildMonthDateRef(overrides.startMonth ?? undefined) ?? undefined;
  const endAt =
    overrides.endAt ??
    (overrides.endMonth === null
      ? null
      : buildMonthDateRef(overrides.endMonth ?? undefined));
  return {
    ...overrides,
    startAt,
    endAt,
  };
};

const cloneEventRefs = (eventRefs?: ScenarioEventRef[]) =>
  eventRefs?.map((ref) => ({
    ...ref,
    highlighted: ref.highlighted ?? false,
    overrides: migrateEventRuleOverrides(ref.overrides),
  }));

const cloneScenarioEvents = (events?: ScenarioEvent[]) =>
  events?.map((event) => ({
    ...event,
    tags: event.tags ? [...event.tags] : undefined,
  }));

const cloneScenarioAssets = (assets?: ScenarioAsset[]) =>
  assets?.map((asset) => ({ ...asset }));

const cloneScenarioLiabilities = (liabilities?: ScenarioLiability[]) =>
  liabilities?.map((liability) => ({ ...liability }));

const cloneBundleWizardInput = (input: BundleWizardInput): BundleWizardInput => {
  if (input.templateId === "life_new_baby_plan") {
    return {
      templateId: input.templateId,
      input: { ...input.input },
    };
  }
  if (input.templateId === "life_home_purchase") {
    return {
      templateId: input.templateId,
      input: {
        ...input.input,
        feesOneOff: input.input.feesOneOff?.map((fee) => ({ ...fee })),
        ongoingCosts: input.input.ongoingCosts?.map((cost) => ({ ...cost })),
        rental: input.input.rental ? { ...input.input.rental } : undefined,
      },
    };
  }
  if (input.templateId === "life_marriage_plan") {
    return {
      templateId: input.templateId,
      input: {
        ...input.input,
        breakdownItems: input.input.breakdownItems.map((item) => ({ ...item })),
      },
    };
  }
  return input;
};

const cloneBundleInstances = (records?: BundleInstanceRecord[]) =>
  records?.map((record) => ({
    ...record,
    wizardInput: cloneBundleWizardInput(record.wizardInput),
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

const cloneMilestoneEvents = (events?: MilestoneEvent[]) =>
  events?.map((event) => ({
    ...event,
    payload: JSON.parse(JSON.stringify(event.payload)) as MilestoneEvent["payload"],
  }));

const clonePositions = (positions?: ScenarioPositions): ScenarioPositions | undefined => {
  if (!positions) {
    return positions;
  }

  return {
    home: positions.home ? { ...positions.home } : undefined,
    homes: positions.homes
      ? positions.homes.map((home) => ({
          ...home,
          purchaseFees: home.purchaseFees
            ? home.purchaseFees.map((fee) => ({ ...fee }))
            : undefined,
          ongoingCosts: home.ongoingCosts
            ? home.ongoingCosts.map((entry) => ({ ...entry }))
            : undefined,
          rental: home.rental ? { ...home.rental } : undefined,
        }))
      : undefined,
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
          purchaseFees: car.purchaseFees
            ? car.purchaseFees.map((fee) => ({ ...fee }))
            : undefined,
          ongoingCosts: car.ongoingCosts
            ? car.ongoingCosts.map((entry) => ({ ...entry }))
            : undefined,
          loan: car.loan ? { ...car.loan } : undefined,
        }))
      : undefined,
    cashBuckets: positions.cashBuckets
      ? positions.cashBuckets.map((bucket) => ({ ...bucket }))
      : undefined,
  };
};

const findGeneratedEntitiesForScenario = (
  state: ScenarioStoreState,
  scenarioId: string,
  eventId: string
): GeneratedEntitySummary => {
  const scenario = state.scenarios.find((entry) => entry.id === scenarioId);
  const positions = scenario?.positions;

  return {
    eventDefinitionIds: state.eventLibrary
      .filter((definition) => definition.generatedByEventId === eventId)
      .map((definition) => definition.id),
    budgetRuleIds: state.budgetRules
      .filter((rule) => rule.generatedByEventId === eventId)
      .map((rule) => rule.id),
    homeIds:
      positions?.homes?.filter((home) => home.generatedByEventId === eventId).map((home) => home.id) ??
      [],
    investmentIds:
      positions?.investments
        ?.filter((investment) => investment.generatedByEventId === eventId)
        .map((investment) => investment.id ?? "")
        .filter(Boolean) ?? [],
    insuranceIds:
      positions?.insurances
        ?.filter((insurance) => insurance.generatedByEventId === eventId)
        .map((insurance) => insurance.id ?? "")
        .filter(Boolean) ?? [],
    carIds:
      positions?.cars
        ?.filter((car) => car.generatedByEventId === eventId)
        .map((car) => car.id ?? "")
        .filter(Boolean) ?? [],
    loanIds:
      positions?.loans
        ?.filter((loan) => loan.generatedByEventId === eventId)
        .map((loan) => loan.id ?? "")
        .filter(Boolean) ?? [],
  };
};

const cleanupGeneratedEntitiesForScenario = (
  state: ScenarioStoreState,
  scenarioId: string,
  eventId: string
): ScenarioStoreState => {
  const summary = findGeneratedEntitiesForScenario(state, scenarioId, eventId);
  const nextEventLibrary = state.eventLibrary.filter(
    (definition) => !summary.eventDefinitionIds.includes(definition.id)
  );
  const nextBudgetRules = state.budgetRules.filter(
    (rule) => !summary.budgetRuleIds.includes(rule.id)
  );

  const nextScenarios = state.scenarios.map((scenario) => {
    if (scenario.id !== scenarioId) {
      return scenario;
    }

    const nextEventRefs =
      scenario.eventRefs?.filter((ref) => !summary.eventDefinitionIds.includes(ref.refId)) ?? [];
    const positions = scenario.positions;

    if (!positions) {
      return {
        ...scenario,
        eventRefs: nextEventRefs,
      };
    }

    return {
      ...scenario,
      eventRefs: nextEventRefs,
      positions: {
        ...positions,
        homes: positions.homes?.filter((home) => !summary.homeIds.includes(home.id)),
        investments: positions.investments?.filter(
          (investment) => !summary.investmentIds.includes(investment.id ?? "")
        ),
        insurances: positions.insurances?.filter(
          (insurance) => !summary.insuranceIds.includes(insurance.id ?? "")
        ),
        cars: positions.cars?.filter((car) => !summary.carIds.includes(car.id ?? "")),
        loans: positions.loans?.filter((loan) => !summary.loanIds.includes(loan.id ?? "")),
      },
    };
  });

  return {
    ...state,
    eventLibrary: nextEventLibrary,
    budgetRules: nextBudgetRules,
    scenarios: nextScenarios,
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
  purchaseFees: home.purchaseFees ? home.purchaseFees.map((fee) => ({ ...fee })) : undefined,
  ongoingCosts: home.ongoingCosts
    ? home.ongoingCosts.map((entry) => ({ ...entry }))
    : undefined,
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
  purchaseFees: car.purchaseFees ? car.purchaseFees.map((fee) => ({ ...fee })) : undefined,
  ongoingCosts: car.ongoingCosts
    ? car.ongoingCosts.map((entry) => ({ ...entry }))
    : undefined,
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

const applyLifecycleLazyMigration = (scenario: Scenario): Scenario => {
  const hasLifecycleSignal =
    scenario.meta?.onboarded === true ||
    Boolean(scenario.meta?.onboardedAt) ||
    scenario.meta?.skipOnboarding === true ||
    scenario.meta?.isSeeded === true ||
    scenario.clientComputed?.onboardingCompleted === true;

  if (hasLifecycleSignal) {
    return scenario;
  }

  const hasLifecycleData =
    Boolean(scenario.assumptions?.baseMonth) &&
    (((scenario.eventRefs ?? []).length > 0) || hasScenarioPositions(scenario.positions));

  if (!hasLifecycleData) {
    return scenario;
  }

  return {
    ...scenario,
    meta: {
      ...(scenario.meta ?? {}),
      schemaVersion: scenario.meta?.schemaVersion ?? 2,
    },
    clientComputed: {
      ...(scenario.clientComputed ?? {}),
      onboardingCompleted: true,
    },
  };
};

type LegacyScenario = Scenario & {
  members?: ScenarioMember[];
  budgetRules?: BudgetRule[];
};

export const normalizeScenario = (scenario: LegacyScenario): Scenario => {
  const migratedScenario = applyLifecycleLazyMigration(scenario);
  const normalizedPositions = normalizeScenarioPositions(
    migratedScenario.positions,
    migratedScenario.assumptions?.baseMonth
  );
  const normalizedEventRefs = cloneEventRefs(migratedScenario.eventRefs) ?? [];
  const normalizedEvents =
    cloneScenarioEvents(migratedScenario.events) ??
    (migratedScenario.meta?.schemaVersion === 2 ? [] : undefined);
  const normalizedAssets =
    cloneScenarioAssets(migratedScenario.assets) ??
    (migratedScenario.meta?.schemaVersion === 2 ? [] : undefined);
  const normalizedLiabilities =
    cloneScenarioLiabilities(migratedScenario.liabilities) ??
    (migratedScenario.meta?.schemaVersion === 2 ? [] : undefined);
  const normalizedScenarioMembers =
    cloneMembers(migratedScenario.members) ??
    (migratedScenario.meta?.schemaVersion === 2 ? [] : undefined);
  const normalizedClientComputed = cloneClientComputed(migratedScenario.clientComputed);
  const normalizedSnapshots = cloneSnapshots(migratedScenario.snapshots);
  const normalizedPlans = clonePlans(migratedScenario.plans);
  const normalizedMilestoneEvents = normalizeMilestoneEvents(migratedScenario.milestoneEvents);
  const normalizedBundleInstances =
    cloneBundleInstances(migratedScenario.bundleInstances) ??
    (migratedScenario.meta?.schemaVersion === 2 ? [] : undefined);
  const normalizedAssumptions = {
    ...defaultAssumptions,
    ...migratedScenario.assumptions,
  };
  const nextClientComputed = shouldAutoCompleteOnboarding(migratedScenario)
    ? { ...(normalizedClientComputed ?? {}), onboardingCompleted: true }
    : normalizedClientComputed;

  if (!normalizedPositions) {
    return {
      ...scenario,
      ...migratedScenario,
      assumptions: normalizedAssumptions,
      members: normalizedScenarioMembers,
      assets: normalizedAssets,
      liabilities: normalizedLiabilities,
      events: normalizedEvents,
      bundleInstances: normalizedBundleInstances,
      eventRefs: normalizedEventRefs,
      milestoneEvents: normalizedMilestoneEvents,
      clientComputed: nextClientComputed,
      snapshots: normalizedSnapshots,
      plans: normalizedPlans,
      version: scenario.version ?? defaultScenarioVersion,
    };
  }

  return {
    ...migratedScenario,
    assumptions: normalizedAssumptions,
    members: normalizedScenarioMembers,
    assets: normalizedAssets,
    liabilities: normalizedLiabilities,
    events: normalizedEvents,
    positions: normalizedPositions,
    bundleInstances: normalizedBundleInstances,
    eventRefs: normalizedEventRefs,
    milestoneEvents: normalizedMilestoneEvents,
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

export const isLegacyOnboardingScenario = (scenario?: Scenario | null) => {
  const onboardingVersion = scenario?.meta?.onboardingVersion;
  return !onboardingVersion || onboardingVersion < 2;
};

export const isScenarioV2 = (scenario?: Scenario | null) => {
  if (!scenario) {
    return false;
  }

  if (scenario.meta?.schemaVersion === 2) {
    return true;
  }

  return scenario.meta?.onboarded === true && Array.isArray(scenario.events);
};

export const resetAppState = () => {
  const state = useScenarioStore.getState();
  useScenarioStore.setState({
    scenarios: normalizeScenarioList(state.scenarios),
    eventLibrary: state.eventLibrary.map((event) => ({
      ...event,
      rule: migrateEventRule(event.rule),
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
      members: [],
      assets: [],
      liabilities: [],
      events: [],
      eventRefs: [],
      milestoneEvents: [],
      snapshots: [],
      plans: [],
      bundleInstances: [],
      meta: { schemaVersion: 2 },
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
  createScenarioFromSeed: (name, seed) => {
    const created = get().createScenario(name);
    if (!created) {
      return null;
    }
    const scenarioId = created.id;
    const scenario = get().scenarios.find((entry) => entry.id === scenarioId);
    if (!scenario) {
      return null;
    }

    const resolveSeedMemberId = (roleKey: string) => `${scenarioId}:member:${roleKey}`;
    const seedMemberIdMap = new Map(
      seed.members.map((member) => [member.id, resolveSeedMemberId(member.id)])
    );

    const draft = buildScenarioDraftFromSeed(seed);

    const submitResult = submitScenarioDraft({
      source: "seed",
      target: { scenarioId },
      draft: {
        ...draft,
        members: (draft.members ?? []).map((member) => ({
          ...member,
          id: seedMemberIdMap.get(member.id) ?? member.id,
        })),
        events: (draft.events ?? []).map((event) =>
          event.memberId
            ? {
                ...event,
                memberId: seedMemberIdMap.get(event.memberId) ?? event.memberId,
              }
            : event
        ),
      },
      context: {
        assumptionsBase: scenario.assumptions,
        metaBase: scenario.meta,
        clientComputedBase: scenario.clientComputed,
      },
      persistence: {
        applyStore: (payload) => {
          set((state) => ({
            scenarios: state.scenarios.map((candidate) =>
              candidate.id === scenarioId
                ? {
                    ...candidate,
                    baseCurrency: payload.baseCurrency,
                    assumptions: payload.assumptions,
                    members: payload.members,
                    assets: payload.assets,
                    liabilities: payload.liabilities,
                    events: payload.events,
                    meta: payload.meta,
                    clientComputed: payload.clientComputed,
                    bundleInstances: cloneBundleInstances(seed.bundleInstances),
                    updatedAt: now(),
                  }
                : candidate
            ),
          }));
        },
      },
    });

    if (!submitResult.ok) {
      return null;
    }

    return get().scenarios.find((scenario) => scenario.id === scenarioId) ?? null;
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
      members: cloneMembers(source.members),
      assets: cloneScenarioAssets(source.assets),
      liabilities: cloneScenarioLiabilities(source.liabilities),
      events: cloneScenarioEvents(source.events),
      eventRefs: cloneEventRefs(source.eventRefs),
      milestoneEvents: cloneMilestoneEvents(source.milestoneEvents),
      positions: clonePositions(source.positions),
      clientComputed: cloneClientComputed(source.clientComputed),
      snapshots: cloneSnapshots(source.snapshots),
      plans: [],
      bundleInstances: cloneBundleInstances(source.bundleInstances),
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
  upsertScenarioAssets: (id, assets) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }
        const existing = scenario.assets ?? [];
        const incomingById = new Map(assets.map((asset) => [asset.id, asset]));
        const nextAssets = [
          ...existing.map((asset) => incomingById.get(asset.id) ?? asset),
          ...assets.filter((asset) => !existing.some((item) => item.id === asset.id)),
        ];
        return {
          ...scenario,
          assets: nextAssets,
          updatedAt: now(),
        };
      }),
    }));
  },
  upsertScenarioLiabilities: (id, liabilities) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) => {
        if (scenario.id !== id) {
          return scenario;
        }
        const existing = scenario.liabilities ?? [];
        const incomingById = new Map(
          liabilities.map((liability) => [liability.id, liability])
        );
        const nextLiabilities = [
          ...existing.map(
            (liability) => incomingById.get(liability.id) ?? liability
          ),
          ...liabilities.filter(
            (liability) => !existing.some((item) => item.id === liability.id)
          ),
        ];
        return {
          ...scenario,
          liabilities: nextLiabilities,
          updatedAt: now(),
        };
      }),
    }));
  },
  setScenarioAssets: (id, assets) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              assets,
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  setScenarioLiabilities: (id, liabilities) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              liabilities,
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  setScenarioMembers: (id, members) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              members,
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  setScenarioEvents: (id, events) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              events,
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  addEvent: (event, scenarioId) => {
    const resolvedScenarioId = scenarioId ?? get().activeScenarioId;
    const scenario = get().scenarios.find(
      (entry) => entry.id === resolvedScenarioId
    );
    if (!scenario) {
      return { ok: false, error: "Scenario not found." };
    }
    const isV2 = scenario.meta?.schemaVersion === 2;

    const candidate = {
      ...event,
      id: event.id ?? createScenarioEventId(),
    };
    const normalizedCandidate =
      candidate.type === "cashflow"
        ? normalizeCashflowGrowth(candidate)
        : candidate;
    const parsed = ScenarioEventSchema.safeParse(normalizedCandidate);
    if (!parsed.success) {
      return { ok: false, error: "Invalid event payload." };
    }
    const refined =
      parsed.data.type === "cashflow"
        ? CashflowEventSchema.safeParse(parsed.data)
        : parsed;
    if (!refined.success) {
      return { ok: false, error: "Invalid event payload." };
    }

    set((state) => ({
      scenarios: state.scenarios.map((entry) =>
        entry.id === resolvedScenarioId
          ? (() => {
              const nextEvents = [...(entry.events ?? []), refined.data];
              const { assets, liabilities } = isV2
                ? upsertEventGeneratedEntities({
                    existingAssets: entry.assets ?? [],
                    existingLiabilities: entry.liabilities ?? [],
                    event: refined.data,
                  })
                : {
                    assets: entry.assets ?? [],
                    liabilities: entry.liabilities ?? [],
                  };
              return {
                ...entry,
                events: nextEvents,
                assets,
                liabilities,
                updatedAt: now(),
              };
            })()
          : entry
      ),
    }));

    return { ok: true, event: refined.data };
  },
  replaceBundleEvents: (bundleInstanceId, events, scenarioId) => {
    const resolvedScenarioId = scenarioId ?? get().activeScenarioId;
    const scenario = get().scenarios.find(
      (entry) => entry.id === resolvedScenarioId
    );
    if (!scenario) {
      return { ok: false, error: "Scenario not found." };
    }
    const isV2 = scenario.meta?.schemaVersion === 2;
    if (!isV2) {
      return { ok: false, error: "Scenario must be v2." };
    }

    const parsedEvents: ScenarioEvent[] = [];
    for (const event of events) {
      const candidate = {
        ...event,
        id: event.id ?? createScenarioEventId(),
      };
      const normalizedCandidate =
        candidate.type === "cashflow"
          ? normalizeCashflowGrowth(candidate)
          : candidate;
      const parsed = ScenarioEventSchema.safeParse(normalizedCandidate);
      if (!parsed.success) {
        return { ok: false, error: "Invalid event payload." };
      }
      const refined =
        parsed.data.type === "cashflow"
          ? CashflowEventSchema.safeParse(parsed.data)
          : parsed;
      if (!refined.success) {
        return { ok: false, error: "Invalid event payload." };
      }
      parsedEvents.push(refined.data);
    }

    const existingEvents = scenario.events ?? [];
    const removedEventIds = new Set(
      existingEvents
        .filter((event) => event.source?.bundleInstanceId === bundleInstanceId)
        .map((event) => event.id)
    );
    const remainingEvents = existingEvents.filter(
      (event) => !removedEventIds.has(event.id)
    );
    const { referencedAssetIds, referencedLiabilityIds } =
      collectReferencedEntityIds(remainingEvents);

    let nextAssets = (scenario.assets ?? []).filter((asset) => {
      if (!asset.createdByEventId || !removedEventIds.has(asset.createdByEventId)) {
        return true;
      }
      return referencedAssetIds.has(asset.id);
    });
    let nextLiabilities = (scenario.liabilities ?? []).filter((liability) => {
      if (
        !liability.createdByEventId ||
        !removedEventIds.has(liability.createdByEventId)
      ) {
        return true;
      }
      return referencedLiabilityIds.has(liability.id);
    });

    parsedEvents.forEach((event) => {
      const updated = upsertEventGeneratedEntities({
        existingAssets: nextAssets,
        existingLiabilities: nextLiabilities,
        event,
      });
      nextAssets = updated.assets;
      nextLiabilities = updated.liabilities;
    });

    const nextEvents = [...remainingEvents, ...parsedEvents];

    set((state) => ({
      scenarios: state.scenarios.map((entry) =>
        entry.id === resolvedScenarioId
          ? {
              ...entry,
              events: nextEvents,
              assets: nextAssets,
              liabilities: nextLiabilities,
              updatedAt: now(),
            }
          : entry
      ),
    }));

    return { ok: true };
  },
  upsertBundleInstanceRecord: (scenarioId, record) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === scenarioId
          ? (() => {
              const existing = scenario.bundleInstances ?? [];
              const index = existing.findIndex((entry) => entry.id === record.id);
              const nextRecords =
                index >= 0
                  ? [
                      ...existing.slice(0, index),
                      record,
                      ...existing.slice(index + 1),
                    ]
                  : [...existing, record];
              return {
                ...scenario,
                bundleInstances: nextRecords,
                updatedAt: now(),
              };
            })()
          : scenario
      ),
    }));
  },
  removeBundleInstanceRecord: (scenarioId, bundleInstanceId) => {
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === scenarioId
          ? {
              ...scenario,
              bundleInstances: (scenario.bundleInstances ?? []).filter(
                (record) => record.id !== bundleInstanceId
              ),
              updatedAt: now(),
            }
          : scenario
      ),
    }));
  },
  updateEvent: (eventId, patch, scenarioId) => {
    const resolvedScenarioId = scenarioId ?? get().activeScenarioId;
    const scenario = get().scenarios.find(
      (entry) => entry.id === resolvedScenarioId
    );
    if (!scenario) {
      return { ok: false, error: "Scenario not found." };
    }
    const isV2 = scenario.meta?.schemaVersion === 2;

    const events = scenario.events ?? [];
    const target = events.find((entry) => entry.id === eventId);
    if (!target) {
      return { ok: false, error: "Event not found." };
    }

    if (
      target.type === "housing" &&
      target.kind === "mortgage" &&
      ("kind" in patch ? patch.kind === "rent" : false) &&
      (target.propertyAssetId || target.mortgageLiabilityId)
    ) {
      return {
        ok: false,
        error: "Cannot switch housing mode after linked entities exist.",
      };
    }

    if (
      target.type === "insurance" &&
      target.mode === "detailed" &&
      ("mode" in patch ? patch.mode === "quick" : false) &&
      (target.policies ?? []).some((policy) => policy.policyAssetId)
    ) {
      return {
        ok: false,
        error: "Cannot switch insurance mode after linked assets exist.",
      };
    }

    const merged = {
      ...target,
      ...patch,
      id: target.id,
      type: target.type,
    };
    const parsed = ScenarioEventSchema.safeParse(merged);
    if (!parsed.success) {
      return { ok: false, error: "Invalid event payload." };
    }
    const refined =
      parsed.data.type === "cashflow"
        ? CashflowEventSchema.safeParse(parsed.data)
        : parsed;
    if (!refined.success) {
      return { ok: false, error: "Invalid event payload." };
    }

    set((state) => ({
      scenarios: state.scenarios.map((entry) =>
        entry.id === resolvedScenarioId
          ? (() => {
              const nextEvents = (entry.events ?? []).map((entryEvent) =>
                entryEvent.id === eventId ? refined.data : entryEvent
              );
              const { assets, liabilities } = isV2
                ? upsertEventGeneratedEntities({
                    existingAssets: entry.assets ?? [],
                    existingLiabilities: entry.liabilities ?? [],
                    event: refined.data,
                  })
                : {
                    assets: entry.assets ?? [],
                    liabilities: entry.liabilities ?? [],
                  };
              return {
                ...entry,
                events: nextEvents,
                assets,
                liabilities,
                updatedAt: now(),
              };
            })()
          : entry
      ),
    }));

    return { ok: true, event: refined.data };
  },
  removeEvent: (eventId, scenarioId, options) => {
    const resolvedScenarioId = scenarioId ?? get().activeScenarioId;
    const scenario = get().scenarios.find(
      (entry) => entry.id === resolvedScenarioId
    );
    if (!scenario) {
      return { ok: false, error: "Scenario not found." };
    }

    const impact = buildEventDeleteImpact(scenario, eventId);
    if (!impact) {
      return { ok: false, error: "Event not found." };
    }

    const existing = scenario.events ?? [];
    const nextEvents = existing.filter((event) => event.id !== eventId);
    const canCascade = impact.safeToCascade;
    const requestedCascade = options?.cascade ?? canCascade;
    const shouldCascade = requestedCascade && canCascade;

    set((state) => ({
      scenarios: state.scenarios.map((entry) =>
        entry.id === resolvedScenarioId
          ? (() => {
              const assets = shouldCascade
                ? (entry.assets ?? []).filter(
                    (asset) =>
                      !impact.impactedAssets.some(
                        (impacted) => impacted.id === asset.id
                      )
                  )
                : entry.assets ?? [];
              const liabilities = shouldCascade
                ? (entry.liabilities ?? []).filter(
                    (liability) =>
                      !impact.impactedLiabilities.some(
                        (impacted) => impacted.id === liability.id
                      )
                  )
                : entry.liabilities ?? [];
              return {
                ...entry,
                events: nextEvents,
                assets,
                liabilities,
                updatedAt: now(),
              };
            })()
          : entry
      ),
    }));

    return { ok: true, impact };
  },
  duplicateEvent: (eventId, scenarioId) => {
    const resolvedScenarioId = scenarioId ?? get().activeScenarioId;
    const scenario = get().scenarios.find(
      (entry) => entry.id === resolvedScenarioId
    );
    if (!scenario) {
      return { ok: false, error: "Scenario not found." };
    }
    const isV2 = scenario.meta?.schemaVersion === 2;

    const target = (scenario.events ?? []).find((event) => event.id === eventId);
    if (!target) {
      return { ok: false, error: "Event not found." };
    }

    const duplicated = {
      ...target,
      id: createScenarioEventId(),
      label: target.label ? `${target.label} (Copy)` : target.label,
    };
    const parsed = ScenarioEventSchema.safeParse(duplicated);
    if (!parsed.success) {
      return { ok: false, error: "Invalid event payload." };
    }
    const refined =
      parsed.data.type === "cashflow"
        ? CashflowEventSchema.safeParse(parsed.data)
        : parsed;
    if (!refined.success) {
      return { ok: false, error: "Invalid event payload." };
    }

    set((state) => ({
      scenarios: state.scenarios.map((entry) =>
        entry.id === resolvedScenarioId
          ? (() => {
            const nextEvents = [...(entry.events ?? []), refined.data];
            const { assets, liabilities } = isV2
              ? upsertEventGeneratedEntities({
                  existingAssets: entry.assets ?? [],
                  existingLiabilities: entry.liabilities ?? [],
                  event: refined.data,
                })
              : {
                  assets: entry.assets ?? [],
                  liabilities: entry.liabilities ?? [],
                };
            return {
              ...entry,
              events: nextEvents,
                assets,
                liabilities,
                updatedAt: now(),
              };
            })()
          : entry
      ),
    }));

    return { ok: true, event: refined.data };
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
  updateScenarioBaseCurrency: (id, baseCurrency) => {
    const nextCurrency = baseCurrency.trim();
    if (!nextCurrency) {
      return;
    }

    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === id
          ? {
              ...scenario,
              baseCurrency: nextCurrency,
              updatedAt: now(),
              version:
                scenario.baseCurrency === nextCurrency
                  ? ensureScenarioVersion(scenario)
                  : bumpScenarioVersion(scenario),
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

          if (Object.prototype.hasOwnProperty.call(patch, "rentAnnualGrowthPct")) {
            nextAssumptions.rentAnnualGrowthPct = patch.rentAnnualGrowthPct;
            if (patch.rentAnnualGrowthPct !== scenario.assumptions.rentAnnualGrowthPct) {
              didChange = true;
            }
          }

          if (
            Object.prototype.hasOwnProperty.call(
              patch,
              "investmentReturnAssumptions"
            )
          ) {
            nextAssumptions.investmentReturnAssumptions =
              patch.investmentReturnAssumptions;
            if (
              patch.investmentReturnAssumptions !==
              scenario.assumptions.investmentReturnAssumptions
            ) {
              didChange = true;
            }
          }

          if (Object.prototype.hasOwnProperty.call(patch, "propertyAppreciationPct")) {
            nextAssumptions.propertyAppreciationPct = patch.propertyAppreciationPct;
            if (
              patch.propertyAppreciationPct !==
              scenario.assumptions.propertyAppreciationPct
            ) {
              didChange = true;
            }
          }

          if (Object.prototype.hasOwnProperty.call(patch, "carDepreciationRatePct")) {
            nextAssumptions.carDepreciationRatePct = patch.carDepreciationRatePct;
            if (
              patch.carDepreciationRatePct !==
              scenario.assumptions.carDepreciationRatePct
            ) {
              didChange = true;
            }
          }

          if (Object.prototype.hasOwnProperty.call(patch, "cashYieldPct")) {
            nextAssumptions.cashYieldPct = patch.cashYieldPct;
            if (patch.cashYieldPct !== scenario.assumptions.cashYieldPct) {
              didChange = true;
            }
          }

          if (Object.prototype.hasOwnProperty.call(patch, "taxInputMode")) {
            nextAssumptions.taxInputMode = patch.taxInputMode;
            if (patch.taxInputMode !== scenario.assumptions.taxInputMode) {
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
  applyMilestoneEvent: (scenarioId, draft) => {
    const state = get();
    const scenario = state.scenarios.find((entry) => entry.id === scenarioId);
    if (!scenario) {
      return { ops: [], warnings: [], fieldErrors: { scenario: "Scenario not found." } };
    }

    const eventId = draft.id ?? `milestone-${nanoid(8)}`;
    const existingEvent = scenario.milestoneEvents?.find((event) => event.id === eventId);
    const timestamp = now();
    const event: MilestoneEvent = {
      ...draft,
      id: eventId,
      createdAt: existingEvent?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    const snapshot = buildMilestoneScenarioSnapshot({
      scenario,
      eventLibrary: state.eventLibrary,
      budgetRules: state.budgetRules,
    });
    const compileResult = compileEventToOps(event, snapshot);

    if (Object.keys(compileResult.fieldErrors).length > 0) {
      return compileResult;
    }

    set((current) => {
      let workingState = current;
      if (existingEvent) {
        workingState = cleanupGeneratedEntitiesForScenario(
          workingState,
          scenarioId,
          eventId
        );
      }

      const scenarioIndex = workingState.scenarios.findIndex(
        (entry) => entry.id === scenarioId
      );
      if (scenarioIndex === -1) {
        return workingState;
      }

      const baseMonth = workingState.scenarios[scenarioIndex].assumptions.baseMonth ?? null;
      const nextEventLibrary = [...workingState.eventLibrary];
      const nextBudgetRules = [...workingState.budgetRules];
      let nextScenario = { ...workingState.scenarios[scenarioIndex] };
      let nextEventRefs = [...(nextScenario.eventRefs ?? [])];
      let nextPositions = nextScenario.positions;

      compileResult.ops.forEach((op) => {
        if (op.entity === "moneyItem") {
          if (op.action === "remove") {
            if (op.item.sourceType === "budgetRule" && op.item.sourceId) {
              const index = nextBudgetRules.findIndex((rule) => rule.id === op.item.sourceId);
              if (index >= 0) {
                nextBudgetRules.splice(index, 1);
              }
            } else if (op.item.sourceId) {
              const defIndex = nextEventLibrary.findIndex(
                (definition) => definition.id === op.item.sourceId
              );
              if (defIndex >= 0) {
                nextEventLibrary.splice(defIndex, 1);
              }
              nextEventRefs = nextEventRefs.filter((ref) => ref.refId !== op.item.sourceId);
            }
            return;
          }

          if (op.item.sourceType === "budgetRule") {
            const rule = buildBudgetRuleFromMoneyItem({
              ...op.item,
              source: "eventGenerated",
              generatedByEventId: eventId,
            });
            nextBudgetRules.push(rule);
            return;
          }

          const definition = buildEventDefinitionFromMoneyItem(
            { ...op.item, generatedByEventId: eventId },
            nextScenario.baseCurrency
          );
          nextEventLibrary.push(definition);
          nextEventRefs.push({ refId: definition.id, enabled: true, highlighted: false });
        }

        if (op.entity === "rule") {
          if (op.action === "remove") {
            const index = nextBudgetRules.findIndex((rule) => rule.id === op.rule.id);
            if (index >= 0) {
              nextBudgetRules.splice(index, 1);
            }
            return;
          }
          nextBudgetRules.push({ ...op.rule, generatedByEventId: eventId, source: "eventGenerated" });
        }

        if (op.entity === "asset") {
          if (op.action === "remove") {
            nextPositions = applyAssetItemRemoveFromPositions(nextPositions, op.item);
            return;
          }
          nextPositions = applyAssetItemUpsertToPositions(nextPositions, op.item, baseMonth);
        }

        if (op.entity === "liability") {
          if (op.action === "remove") {
            nextPositions = applyLiabilityItemRemoveFromPositions(nextPositions, op.item);
            return;
          }
          nextPositions = applyLiabilityItemUpsertToPositions(nextPositions, op.item, baseMonth);
        }
      });

      const nextMilestoneEvents = existingEvent
        ? (nextScenario.milestoneEvents ?? []).map((entry) =>
            entry.id === eventId ? event : entry
          )
        : [...(nextScenario.milestoneEvents ?? []), event];

      nextScenario = {
        ...nextScenario,
        eventRefs: nextEventRefs,
        positions: nextPositions,
        milestoneEvents: nextMilestoneEvents,
        updatedAt: now(),
        version: ensureScenarioVersion(nextScenario),
      };

      const nextScenarios = [...workingState.scenarios];
      nextScenarios[scenarioIndex] = nextScenario;

      return {
        ...workingState,
        eventLibrary: nextEventLibrary,
        budgetRules: nextBudgetRules,
        scenarios: nextScenarios,
      };
    });

    return compileResult;
  },
  removeMilestoneEvent: (scenarioId, eventId) => {
    set((state) => {
      const nextState = cleanupGeneratedEntitiesForScenario(state, scenarioId, eventId);
      const nextScenarios = nextState.scenarios.map((scenario) => {
        if (scenario.id !== scenarioId) {
          return scenario;
        }
        return {
          ...scenario,
          milestoneEvents: (scenario.milestoneEvents ?? []).filter((event) => event.id !== eventId),
          updatedAt: now(),
          version: ensureScenarioVersion(scenario),
        };
      });

      return {
        ...nextState,
        scenarios: nextScenarios,
      };
    });
  },
  findGeneratedEntities: (scenarioId, eventId) =>
    findGeneratedEntitiesForScenario(get(), scenarioId, eventId),
  cleanupGeneratedEntities: (scenarioId, eventId) => {
    set((state) => cleanupGeneratedEntitiesForScenario(state, scenarioId, eventId));
  },
}));
