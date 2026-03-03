import type { EventType } from "../../features/timeline/schema";
import type { IncomeSubtype } from "./eventTaxonomy";
import type { GrowthMode } from "../growthMode";
import type { DateRef } from "../dateRef";

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
  startAt?: DateRef;
  endAt?: DateRef | null;
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
  /**
   * @deprecated Legacy business category (`salary`, `rent`, ...).
   * Structural semantics live on Scenario V2 events: `type` + `kind`.
   */
  type: EventType;
  kind: EventDefinitionKind;
  parentId?: string;
  rule: EventRule;
  currency?: string;
  memberId?: string;
  /**
   * Legacy business subcategory for income events.
   */
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
    | "startAt"
    | "endAt"
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
  linkState?: "linked" | "orphaned";
};
