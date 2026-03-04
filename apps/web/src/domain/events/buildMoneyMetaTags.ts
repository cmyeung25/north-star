import type { ScenarioEvent } from "../scenarioV2/events";
import type { ScenarioAsset, ScenarioLiability } from "../../store/scenarioStore";
import type {
  SharedEventViewContract,
  SharedViewLinkState,
  SharedViewSource,
} from "./eventTaxonomy";

export type InputItem = {
  id: string;
  kind?: string;
  type?: string;
  memberId?: string;
  ownerMemberId?: string;
  cadence?: "monthly" | "quarterly" | "yearly" | "oneOff" | "everyNMonths" | "recurring";
  startMonth?: string | null;
  endMonth?: string | null;
  month?: string | null;
};

export type MetaTagDomain = "income" | "expense" | "asset" | "liability";
export type MetaTagBelongsTo = "member" | "household";
export type MetaTagFrequency =
  | "monthly"
  | "quarterly"
  | "yearly"
  | "everyNMonths"
  | "oneOff"
  | "recurring"
  | "none";
export type MetaTagLifecycle = "oneOff" | "ongoing" | "hasEndMonth";

export type MetaTag = SharedEventViewContract & {
  frequency: MetaTagFrequency;
  lifecycle: MetaTagLifecycle;
};

export type MoneyMetaInput = ScenarioEvent | ScenarioAsset | ScenarioLiability | InputItem;

const isScenarioEvent = (value: MoneyMetaInput): value is ScenarioEvent => {
  const eventType = (value as { type?: string }).type;
  return (
    eventType === "cashflow" ||
    eventType === "housing" ||
    eventType === "loan" ||
    eventType === "insurance" ||
    eventType === "adjustment"
  );
};

const isScenarioAsset = (value: MoneyMetaInput): value is ScenarioAsset =>
  "currentValue" in value && !isScenarioEvent(value);

const isScenarioLiability = (value: MoneyMetaInput): value is ScenarioLiability =>
  "principalOutstanding" in value && !isScenarioEvent(value);

const resolveDomain = (value: MoneyMetaInput): MetaTagDomain => {
  if (isScenarioAsset(value)) return "asset";
  if (isScenarioLiability(value)) return "liability";
  if (isScenarioEvent(value)) {
    if (value.type === "cashflow" && value.kind === "income") return "income";
    return "expense";
  }
  return value.kind === "income" ? "income" : "expense";
};

const resolveType = (value: MoneyMetaInput): string => {
  if (isScenarioAsset(value) || isScenarioLiability(value)) return value.kind;
  if (isScenarioEvent(value)) return value.type;
  return value.type ?? "cashflow";
};

const resolveKind = (value: MoneyMetaInput): string => {
  if (isScenarioAsset(value) || isScenarioLiability(value)) return value.kind;
  if (isScenarioEvent(value)) {
    if (value.type === "loan") return value.loanKind;
    if (value.type === "insurance") return value.mode;
    return value.kind;
  }
  return value.kind ?? "expense";
};

const resolveBelongsTo = (value: MoneyMetaInput): MetaTagBelongsTo => {
  if (isScenarioEvent(value)) {
    return value.memberId ? "member" : "household";
  }
  if (isScenarioAsset(value) || isScenarioLiability(value)) {
    return value.ownerMemberId ? "member" : "household";
  }
  return value.memberId || value.ownerMemberId ? "member" : "household";
};

const resolveLinkState = (overrides?: { linkState?: SharedViewLinkState }): SharedViewLinkState =>
  overrides?.linkState ?? "linked";

const resolveSource = (overrides?: { source?: SharedViewSource }): SharedViewSource =>
  overrides?.source ?? "baseline-only";

const resolveFrequency = (value: MoneyMetaInput): MetaTagFrequency => {
  if (isScenarioEvent(value)) {
    if (value.type === "cashflow") return value.cadence;
    return "monthly";
  }
  if (isScenarioAsset(value) || isScenarioLiability(value)) {
    return "none";
  }
  if (value.cadence === "recurring") return "recurring";
  return value.cadence ?? "none";
};

const resolveLifecycle = (value: MoneyMetaInput): MetaTagLifecycle => {
  if (isScenarioEvent(value)) {
    if (value.type === "cashflow") {
      if (value.cadence === "oneOff") {
        return "oneOff";
      }
      return value.endMonth ? "hasEndMonth" : "ongoing";
    }
    if (value.type === "housing") {
      return value.endMonth ? "hasEndMonth" : "ongoing";
    }
    if (value.type === "insurance") {
      return value.endMonth ? "hasEndMonth" : "ongoing";
    }
    return "ongoing";
  }
  if (isScenarioAsset(value) || isScenarioLiability(value)) {
    return "ongoing";
  }
  if (value.cadence === "oneOff" || value.month) return "oneOff";
  return value.endMonth ? "hasEndMonth" : "ongoing";
};

export const buildMoneyMetaTags = (
  value: MoneyMetaInput,
  overrides?: { source?: SharedViewSource; linkState?: SharedViewLinkState }
): MetaTag[] => {
  return [
    {
      domain: resolveDomain(value),
      type: resolveType(value),
      kind: resolveKind(value),
      belongsTo: resolveBelongsTo(value),
      linkState: resolveLinkState(overrides),
      source: resolveSource(overrides),
      frequency: resolveFrequency(value),
      lifecycle: resolveLifecycle(value),
    },
  ];
};
