import type { AssetItemUpsert } from "../../../features/assets/types";
import type { LiabilityItemUpsert } from "../../../features/liabilities/types";
import type {
  MoneyItem,
  MoneyItemCadence,
  MoneyItemKind,
  MoneyItemUpsert,
} from "../../../features/moneyFlow/types";
import type { BudgetRule } from "../../store/scenarioStore";

export type MilestoneEventType = "income" | "expense" | "asset" | "liability";
export type MilestoneEventMode = "impact" | "marker";

export type MilestoneEventTemplateType =
  | "member_birth"
  | "member_school_start"
  | "member_retirement"
  | "custom";

export type MilestoneMoneyPayload = {
  cadence: MoneyItemCadence;
  amount: number;
  currency: string;
  category: string;
  memberId?: string;
  startMonth?: string;
  endMonth?: string;
  month?: string;
  notes?: string;
};

export type MilestoneAssetPayload = {
  assetType: AssetItemUpsert["assetType"];
  name: string;
  currentValue: number;
  currency: string;
  ownerMemberId?: string;
  startMonth?: string;
  notes?: string;
};

export type MilestoneLiabilityPayload = {
  liabilityType: LiabilityItemUpsert["liabilityType"];
  name: string;
  principalOutstanding: number;
  currency: string;
  interestRate?: number;
  startMonth?: string;
  termMonths?: number;
  notes?: string;
};

export type MilestoneEventPayload =
  | { kind: "money"; data: MilestoneMoneyPayload }
  | { kind: "asset"; data: MilestoneAssetPayload }
  | { kind: "liability"; data: MilestoneLiabilityPayload };

export type MilestoneEventBase = {
  id: string;
  mode: MilestoneEventMode;
  templateType?: MilestoneEventTemplateType;
  memberId?: string;
  effectiveMonth: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export type MilestoneImpactEvent = MilestoneEventBase & {
  mode: "impact";
  eventType: MilestoneEventType;
  payload: MilestoneEventPayload;
};

export type MilestoneMarkerEvent = MilestoneEventBase & {
  mode: "marker";
  templateType?: MilestoneEventTemplateType;
  eventType?: MilestoneEventType;
  payload?: MilestoneEventPayload;
};

export type MilestoneEvent = MilestoneImpactEvent | MilestoneMarkerEvent;

export type MilestoneEventDraft = Omit<MilestoneEvent, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

export type MilestoneEventWarning = {
  id: string;
  level: "warning" | "error";
  message: string;
  field?: string;
};

export type MilestoneEventFieldErrors = Record<string, string>;

export type MilestoneEventOp =
  | { action: "upsert" | "remove"; entity: "moneyItem"; item: MoneyItemUpsert }
  | { action: "upsert" | "remove"; entity: "asset"; item: AssetItemUpsert }
  | { action: "upsert" | "remove"; entity: "liability"; item: LiabilityItemUpsert }
  | { action: "upsert" | "remove"; entity: "rule"; rule: BudgetRule };

export type MilestoneEventCompileResult = {
  ops: MilestoneEventOp[];
  warnings: MilestoneEventWarning[];
  fieldErrors: MilestoneEventFieldErrors;
};

export type MilestoneScenarioSnapshot = {
  baseCurrency: string;
  moneyItems: MoneyItem[];
  assets: AssetItemUpsert[];
  liabilities: LiabilityItemUpsert[];
  budgetRules: BudgetRule[];
};

export type GeneratedEntitySummary = {
  eventDefinitionIds: string[];
  budgetRuleIds: string[];
  homeIds: string[];
  investmentIds: string[];
  insuranceIds: string[];
  carIds: string[];
  loanIds: string[];
};

export const resolveMoneyItemKindFromEvent = (
  eventType: MilestoneEventType
): MoneyItemKind | null => {
  if (eventType === "income") {
    return "income";
  }
  if (eventType === "expense") {
    return "expense";
  }
  return null;
};

