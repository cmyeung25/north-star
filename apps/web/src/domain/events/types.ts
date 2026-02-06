import type { EventType, IncomeSubtype } from "../../features/timeline/schema";
import type { GrowthMode } from "../growthMode";

export type EventRuleScheduleEntry = {
  month: string;
  amount: number;
};

export type SalaryStepBasis = "month" | "age";

export type SalaryStep = {
  id: string;
  basis: SalaryStepBasis;
  startMonth?: string;
  startAgeYears?: number;
  monthlyAmount: number;
  note?: string;
};

export type EventRule = {
  mode: "params" | "schedule";
  startMonth?: string;
  endMonth?: string | null;
  monthlyAmount?: number;
  oneTimeAmount?: number;
  annualGrowthPct?: number;
  growthMode?: GrowthMode;
  schedule?: EventRuleScheduleEntry[];
  salarySteps?: SalaryStep[];
};

export type EventDefinitionKind = "group" | "cashflow";

export type EventDefinition = {
  id: string;
  title: string;
  type: EventType;
  kind: EventDefinitionKind;
  parentId?: string;
  rule: EventRule;
  currency?: string;
  memberId?: string;
  incomeSubtype?: IncomeSubtype;
  endAtAgeYears?: number;
  templateId?: string;
  templateParams?: Record<string, number>;
  generatedByEventId?: string;
  source?: "manual" | "eventGenerated" | "derived";
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
  categoryOverride?: string;
};

export type EventRuleOverrides = Partial<
  Pick<
    EventRule,
    | "startMonth"
    | "endMonth"
    | "monthlyAmount"
    | "oneTimeAmount"
    | "annualGrowthPct"
    | "growthMode"
    | "mode"
    | "schedule"
  >
>;

export type ScenarioEventRef = {
  refId: string;
  enabled: boolean;
  overrides?: EventRuleOverrides;
  highlighted?: boolean;
};

export type ScenarioEventView = {
  definition: EventDefinition;
  ref: ScenarioEventRef;
  rule: EventRule;
};
