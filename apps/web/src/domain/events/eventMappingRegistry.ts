import type { TimelineEvent } from "../../features/timeline/schema";
import type { ScenarioEvent } from "../scenarioV2/events";
import { buildMoneyMetaTags } from "./buildMoneyMetaTags";
import type {
  CashflowEventKind,
  ExpenseCategory,
  IncomeSubtype,
  LegacyEventType,
  StructuralEventType,
  SharedEventViewContract,
  SharedViewSource,
} from "./eventTaxonomy";

type CashflowMapping = {
  structuralType: Extract<StructuralEventType, "cashflow">;
  kind: CashflowEventKind;
  category?: IncomeSubtype;
  expenseCategory?: ExpenseCategory;
};

const LEGACY_TO_CASHFLOW: Record<LegacyEventType, Omit<CashflowMapping, "category">> = {
  salary: { structuralType: "cashflow", kind: "income" },
  custom: { structuralType: "cashflow", kind: "expense" },
  rent: { structuralType: "cashflow", kind: "expense" },
  travel: { structuralType: "cashflow", kind: "expense" },
  tax_benefit: { structuralType: "cashflow", kind: "income" },
  insurance: { structuralType: "cashflow", kind: "expense" },
  buy_home: { structuralType: "cashflow", kind: "expense" },
  baby: { structuralType: "cashflow", kind: "expense" },
  car: { structuralType: "cashflow", kind: "expense" },
  insurance_product: { structuralType: "cashflow", kind: "expense" },
  insurance_premium: { structuralType: "cashflow", kind: "expense" },
  insurance_payout: { structuralType: "cashflow", kind: "income" },
  helper: { structuralType: "cashflow", kind: "expense" },
  investment_contribution: { structuralType: "cashflow", kind: "expense" },
  investment_withdrawal: { structuralType: "cashflow", kind: "income" },
};

const INCOME_LEGACY_BY_SUBTYPE: Record<IncomeSubtype, LegacyEventType> = {
  salary: "salary",
  bonus: "salary",
  freelance: "salary",
  rental: "salary",
  dividend: "salary",
  interest: "salary",
  other: "tax_benefit",
};


const EXPENSE_CATEGORY_BY_LEGACY: Partial<Record<LegacyEventType, ExpenseCategory>> = {
  rent: "property_ownership",
  travel: "travel",
  insurance: "insurance",
  buy_home: "property_ownership",
  baby: "family_support",
  car: "vehicle_ownership",
  insurance_product: "insurance",
  insurance_premium: "insurance",
  helper: "family_support",
  investment_contribution: "other",
  custom: "daily_living",
};

export type EventMappingMetadata = { legacyType: LegacyEventType };

const resolveLegacyTypeFromCashflowMeta = (
  event: Extract<ScenarioEvent, { type: "cashflow" }>
): LegacyEventType | null => {
  const legacyTypeFromMeta = (event.meta as Record<string, unknown> | undefined)?.legacyType;
  if (typeof legacyTypeFromMeta === "string" && legacyTypeFromMeta in LEGACY_TO_CASHFLOW) {
    return legacyTypeFromMeta as LegacyEventType;
  }
  return null;
};

const resolveIncomeCategory = (event: TimelineEvent): IncomeSubtype | undefined => {
  if (event.type !== "salary" && event.type !== "tax_benefit") {
    return undefined;
  }
  return event.incomeSubtype ?? (event.type === "salary" ? "salary" : "other");
};

export const mapLegacyTimelineTypeToScenario = (
  legacyType: LegacyEventType,
  incomeSubtype?: IncomeSubtype
): CashflowMapping => {
  const mapping = LEGACY_TO_CASHFLOW[legacyType];
  if (!mapping) {
    throw new Error(`[event-mapping] Unknown legacy event type: ${legacyType}`);
  }

  if (mapping.kind === "income") {
    return {
      ...mapping,
      category: incomeSubtype ?? (legacyType === "salary" ? "salary" : "other"),
    };
  }

  return {
    ...mapping,
    expenseCategory: EXPENSE_CATEGORY_BY_LEGACY[legacyType] ?? "other",
  };
};

export const mapTimelineEventToScenarioCashflow = (
  event: TimelineEvent
): Extract<ScenarioEvent, { type: "cashflow" }> & { mappingMetadata: EventMappingMetadata } => {
  const mapping = mapLegacyTimelineTypeToScenario(event.type, resolveIncomeCategory(event));
  const amount = event.oneTimeAmount > 0 ? event.oneTimeAmount : event.monthlyAmount;
  const cadence = event.oneTimeAmount > 0 ? "oneOff" : "monthly";

  return {
    id: event.id,
    type: mapping.structuralType,
    kind: mapping.kind,
    cadence,
    amount: Math.abs(amount),
    startMonth: event.startMonth,
    endMonth: event.endMonth ?? undefined,
    occurrenceMonth: cadence === "oneOff" ? event.startMonth : undefined,
    label: event.name,
    memberId: event.memberId,
    tags: [event.type],
    ...(mapping.category ? { category: mapping.category } : {}),
    ...(mapping.expenseCategory ? { expenseCategory: mapping.expenseCategory } : {}),
    meta: {
      legacyType: event.type,
      legacyIncomeSubtype: event.incomeSubtype,
    },
    mappingMetadata: { legacyType: event.type },
  };
};

export const mapScenarioCashflowToLegacyType = (
  event: Extract<ScenarioEvent, { type: "cashflow" }>
): LegacyEventType => {
  const legacyTypeFromMeta = resolveLegacyTypeFromCashflowMeta(event);
  if (legacyTypeFromMeta) {
    return legacyTypeFromMeta;
  }

  if (event.kind === "income") {
    return INCOME_LEGACY_BY_SUBTYPE[event.category ?? "salary"];
  }

  return "custom";
};

export const migrateScenarioCashflowCategoryLazy = (
  event: Extract<ScenarioEvent, { type: "cashflow" }>
): Extract<ScenarioEvent, { type: "cashflow" }> => {
  const legacyType = resolveLegacyTypeFromCashflowMeta(event);

  if (event.kind === "income") {
    if (event.category) {
      return event;
    }
    const rawLegacyIncomeSubtype = (event.meta as Record<string, unknown> | undefined)
      ?.legacyIncomeSubtype;
    const fallbackCategory: IncomeSubtype =
      typeof rawLegacyIncomeSubtype === "string" && rawLegacyIncomeSubtype in INCOME_LEGACY_BY_SUBTYPE
        ? (rawLegacyIncomeSubtype as IncomeSubtype)
        : legacyType === "tax_benefit"
          ? "other"
          : "salary";
    return {
      ...event,
      category: fallbackCategory,
    };
  }

  if (event.expenseCategory) {
    return event;
  }

  return {
    ...event,
    expenseCategory: (legacyType && EXPENSE_CATEGORY_BY_LEGACY[legacyType]) ?? "other",
  };
};

export const legacyIncomeEventTypes = new Set<LegacyEventType>([
  "salary",
  "tax_benefit",
  "insurance_payout",
  "investment_withdrawal",
]);


export const mapScenarioEventToSharedView = (
  event: ScenarioEvent,
  options?: { source?: SharedViewSource }
): SharedEventViewContract => {
  const [meta] = buildMoneyMetaTags(event, { source: options?.source ?? "baseline-only" });
  return {
    domain: meta.domain,
    type: meta.type,
    kind: meta.kind,
    belongsTo: meta.belongsTo,
    linkState: meta.linkState,
    source: meta.source,
  };
};
