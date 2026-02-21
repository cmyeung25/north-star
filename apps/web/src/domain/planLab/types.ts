import type { EventDefinition, ScenarioEventRef } from "../events/types";
import type { ScenarioEvent } from "../scenarioV2/events";
import type {
  BudgetRule,
  CarPositionDraft,
  CashBucketPositionDraft,
  HomePositionDraft,
  InsurancePositionDraft,
  InvestmentPositionDraft,
  LoanPositionDraft,
  ScenarioMember,
} from "../../store/scenarioStore";
import type { SmartInvestAllocation, SmartInvestPolicy } from "../smartInvest/types";
import type { PlanLabScenarioV2Patches } from "./scenarioV2Patches";

export type PlanLabEventPatch = {
  isDisabled?: boolean;
  patch?: Partial<EventDefinition>;
  endMonth?: string;
};

export type PlanLabRulePatch = {
  isDisabled?: boolean;
  patch?: Partial<BudgetRule>;
  endMonth?: string;
};

export type PlanLabPositionPatch = {
  isDisabled?: boolean;
  patch?: Partial<
    | HomePositionDraft
    | CarPositionDraft
    | InvestmentPositionDraft
    | InsurancePositionDraft
    | LoanPositionDraft
    | CashBucketPositionDraft
  >;
};

export type PlanLabSmartInvestPatch = {
  isDisabled?: boolean;
  patch?: Partial<SmartInvestPolicy>;
};

export type PlanLabBaselinePatches = {
  eventPatches?: Record<string, PlanLabEventPatch>;
  rulePatches?: Record<string, PlanLabRulePatch>;
  positionPatches?: Record<string, PlanLabPositionPatch>;
  smartInvestPatch?: PlanLabSmartInvestPatch;
};

export type PlanLabExperimentType =
  | "oneOffExpense"
  | "rangeExpense"
  | "homeBuy"
  | "carPlan"
  | "incomeAdjust"
  | "travelAnnual"
  | "smartInvestAdjust";

export type PlanLabExperimentBase = {
  id: string;
  type: PlanLabExperimentType;
  isEnabled?: boolean;
  title?: string;
};

export type PlanLabOneOffExpenseExperiment = PlanLabExperimentBase & {
  type: "oneOffExpense";
  month?: string;
  amount?: number;
  note?: string;
};

export type PlanLabRangeExpenseExperiment = PlanLabExperimentBase & {
  type: "rangeExpense";
  startMonth?: string;
  endMonth?: string;
  monthlyAmount?: number;
};

export type PlanLabHomeBuyExperiment = PlanLabExperimentBase & {
  type: "homeBuy";
  purchaseMonth?: string;
  purchasePrice?: number;
  downPaymentAmount?: number;
  downPaymentPct?: number;
  mortgageRatePct?: number;
  termYears?: number;
  oneTimeFees?: number;
  holdingCostMonthly?: number;
  annualAppreciationPct?: number;
};

export type PlanLabCarPlanExperiment = PlanLabExperimentBase & {
  type: "carPlan";
  purchaseMonth?: string;
  purchasePrice?: number;
  downPayment?: number;
  annualDepreciationRatePct?: number;
  holdingCostMonthly?: number;
  holdingCostAnnualGrowthPct?: number;
  loanPrincipal?: number;
  loanInterestRatePct?: number;
  loanTermYears?: number;
  loanMonthlyPayment?: number;
};

export type PlanLabIncomeAdjustExperiment = PlanLabExperimentBase & {
  type: "incomeAdjust";
  startMonth?: string;
  monthlyAmount?: number;
};

export type PlanLabTravelAnnualExperiment = PlanLabExperimentBase & {
  type: "travelAnnual";
  startMonth?: string;
  annualAmount?: number;
};

export type PlanLabSmartInvestAdjustExperiment = PlanLabExperimentBase & {
  type: "smartInvestAdjust";
  reserveMode?: SmartInvestPolicy["reserve"]["mode"];
  reserveAmount?: number;
  reserveMonths?: number;
  contributionMode?: SmartInvestPolicy["contribution"]["mode"];
  contributionPct?: number;
  contributionInvestPct?: number;
  contributionThresholdAmount?: number;
  allocation?: SmartInvestAllocation[];
  withdrawalEnabled?: boolean;
  withdrawalMode?: SmartInvestPolicy["withdrawal"]["mode"];
  withdrawalSellOrder?: SmartInvestPolicy["withdrawal"]["sellOrder"];
};

export type PlanLabExperiment =
  | PlanLabOneOffExpenseExperiment
  | PlanLabRangeExpenseExperiment
  | PlanLabHomeBuyExperiment
  | PlanLabCarPlanExperiment
  | PlanLabIncomeAdjustExperiment
  | PlanLabTravelAnnualExperiment
  | PlanLabSmartInvestAdjustExperiment;

export type PlanLabScorecardSettings = {
  firstBucketTargetAmount?: number;
  targetMonth?: string;
};

export type PlanLabDraftAdditions = {
  members?: ScenarioMember[];
  budgetRules?: BudgetRule[];
  events?: Array<{
    definition: EventDefinition;
    ref: ScenarioEventRef;
  }>;
};

export type PlanLabDraft = {
  baselinePatches?: PlanLabBaselinePatches;
  experiments?: PlanLabExperiment[];
  scorecardSettings?: PlanLabScorecardSettings;
  additions?: PlanLabDraftAdditions;
};

export type PlanLabSnapshot = {
  baselinePatches?: PlanLabBaselinePatches;
  experiments?: PlanLabExperiment[];
  scorecardSettings?: PlanLabScorecardSettings;
  additions?: PlanLabDraftAdditions;
  scenarioV2Patches?: PlanLabScenarioV2Patches;
  experimentGroups?: Array<{
    experimentId: string;
    title: string;
    kind?: "ADD_EVENT" | "MODIFY_BASELINE_EVENT" | "ENV_OVERRIDE" | "BUNDLE_EXPERIMENT";
    target?: {
      baselineEventId?: string;
      bundleId?: string;
      envKey?: string;
    };
    envOverrides?: Record<string, number | undefined>;
    changes?: string[];
    affectedEntities?: Array<{
      itemId: string;
      label: string;
      type: string;
    }>;
    isEnabled: boolean;
    itemIds: string[];
    removedItems?: Array<{
      itemId: string;
      removedAt: number;
      meta: {
        label?: string | null;
        type: string;
        amount?: number | null;
        startMonth?: string | null;
        endMonth?: string | null;
        memberName?: string | null;
      };
    }>;
    bundleInstanceId?: string;
    templateId?: string;
    primaryEventId?: string;
    createdAt: number;
  }>;
};

export type PlanLabEventsPatch = {
  add: ScenarioEvent[];
  update: Array<{ id: string; patch: Partial<ScenarioEvent> }>;
  remove: string[];
};

export type PlanLabRulesPatch = {
  add: BudgetRule[];
  update: Array<{ id: string; patch: Partial<BudgetRule> }>;
  remove: string[];
};

export type PlanLabSnapshotPayload = {
  eventsPatch: PlanLabEventsPatch;
  rulesPatch?: PlanLabRulesPatch;
};

export type PlanPatch = {
  op: "set" | "add" | "remove";
  entity: "moneyItem" | "asset" | "liability" | "rule" | "member" | "event";
  id?: string;
  path?: string;
  value?: unknown;
  note?: string;
};

export type PlanSnapshot = {
  id: string;
  baselineScenarioId: string;
  name: string;
  notes?: string;
  tags?: string[];
  createdAt: number;
  updatedAt?: number;
  baselineSignature?: string;
  payload: PlanLabSnapshotPayload;
  snapshot: PlanLabSnapshot;
  /** @deprecated legacy field kept for backward compatibility. */
  scenarioId?: string;
  /** @deprecated legacy field kept for backward compatibility. */
  baselineFingerprint?: string;
};

export type Plan = PlanSnapshot;

export type PlanLabMeta = {
  planLibrary?: PlanSnapshot[];
  lastSelectedPlanId?: string;
};

export type OnboardingDraftBaseline = {
  monthlyIncomeTotal: number;
  monthlyExpenseTotal: number;
  initialCash: number;
};

export type OnboardingDraft = {
  baseline: OnboardingDraftBaseline;
  option?: {
    planLabDraft?: PlanLabDraft;
  };
};
