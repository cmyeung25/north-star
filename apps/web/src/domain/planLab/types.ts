import type { EventDefinition } from "../events/types";
import type {
  BudgetRule,
  CarPositionDraft,
  CashBucketPositionDraft,
  HomePositionDraft,
  InsurancePositionDraft,
  InvestmentPositionDraft,
  LoanPositionDraft,
} from "../../store/scenarioStore";
import type { SmartInvestAllocation, SmartInvestPolicy } from "../smartInvest/types";

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
};

export type PlanLabDraft = {
  baselinePatches?: PlanLabBaselinePatches;
  experiments?: PlanLabExperiment[];
  scorecardSettings?: PlanLabScorecardSettings;
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
