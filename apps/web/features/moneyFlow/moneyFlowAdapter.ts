import { getEventGroup } from "@north-star/engine";
import type { EventDefinition } from "../../src/domain/events/types";
import type { BudgetRule, Scenario } from "../../src/store/scenarioStore";
import { buildScenarioEventViews, buildTimelineEventFromDefinition } from "../../src/domain/events/utils";
import { createBudgetRuleId } from "../../src/store/scenarioStore";
import { createEventId } from "../../components/timeline/utils";
import type { MoneyItem, MoneyItemSourceType, MoneyItemUpsert } from "./types";
import { DEFAULT_ANNUAL_GROWTH_PCT } from "../../src/domain/constants";
import type { EventType } from "../../src/features/timeline/schema";

const resolveEventSource = (definition: EventDefinition): MoneyItem["source"] =>
  definition.templateId ? "eventGenerated" : "manual";

export const buildMoneyItems = (params: {
  scenario: Scenario;
  eventLibrary: EventDefinition[];
  budgetRules: BudgetRule[];
}): MoneyItem[] => {
  const { scenario, eventLibrary, budgetRules } = params;
  const eventViews = buildScenarioEventViews(scenario, eventLibrary);
  const baseCurrency = scenario.baseCurrency;
  const fallbackMonth = scenario.assumptions.baseMonth ?? null;

  const eventItems = eventViews.flatMap((view) => {
    if (view.definition.kind !== "cashflow") {
      return [];
    }
    const event = buildTimelineEventFromDefinition(view.definition, view.ref, {
      baseCurrency,
      fallbackMonth,
    });
    const group = getEventGroup(event.type);
    if (group !== "income" && group !== "expense") {
      return [];
    }

    const hasMonthly = Boolean(event.monthlyAmount);
    const cadence = hasMonthly ? "recurring" : "oneOff";
    const amount = hasMonthly ? event.monthlyAmount : event.oneTimeAmount;

    // If both monthly + one-off amounts are set, prefer recurring to avoid double counting
    // in the unified MoneyItem list (one-off amount remains in the underlying event rule).
    const item: MoneyItem = {
      id: `event:${event.id}`,
      kind: group,
      cadence,
      amount,
      currency: event.currency,
      category: event.type,
      memberId: event.memberId,
      startMonth: cadence === "recurring" ? event.startMonth : undefined,
      endMonth: cadence === "recurring" ? event.endMonth : undefined,
      month: cadence === "oneOff" ? event.startMonth : undefined,
      notes: event.name,
      source: resolveEventSource(view.definition),
      sourceId: view.definition.id,
      sourceType: "event",
    };

    return [item];
  });

  const ruleItems = budgetRules.map((rule) => ({
    id: `rule:${rule.id}`,
    kind: "expense" as const,
    cadence: "recurring" as const,
    amount: rule.monthlyAmount,
    currency: baseCurrency,
    category: rule.category,
    memberId: rule.memberId,
    startMonth: rule.startMonth ?? undefined,
    endMonth: rule.endMonth ?? undefined,
    notes: rule.name,
    source: "manual" as const,
    sourceId: rule.id,
    sourceType: "budgetRule" as const,
  }));

  return [...eventItems, ...ruleItems];
};

export const upsertMoneyItem = (params: {
  item: MoneyItemUpsert;
  scenarioId: string;
  baseCurrency: string;
  eventLibrary: EventDefinition[];
  budgetRules: BudgetRule[];
  actions: {
    createBudgetRule: (rule: BudgetRule) => void;
    updateBudgetRule: (ruleId: string, patch: Partial<BudgetRule>) => void;
    addEventToScenarios: (definition: EventDefinition, scenarioIds: string[]) => void;
    updateEventDefinition: (id: string, patch: Partial<EventDefinition>) => void;
  };
  resolveCategoryLabel: (category: string) => string;
}) => {
  const {
    item,
    scenarioId,
    baseCurrency,
    eventLibrary,
    budgetRules,
    actions,
    resolveCategoryLabel,
  } = params;

  const sourceType: MoneyItemSourceType =
    item.sourceType ??
    (item.kind === "expense" && item.cadence === "recurring" ? "budgetRule" : "event");

  if (sourceType === "budgetRule") {
    const existingRule = item.sourceId
      ? budgetRules.find((rule) => rule.id === item.sourceId)
      : undefined;
    const nextRuleId = existingRule?.id ?? createBudgetRuleId();
    const nextName = item.notes?.trim() || resolveCategoryLabel(item.category);
    const nextRule: BudgetRule = {
      id: nextRuleId,
      name: nextName,
      enabled: existingRule?.enabled ?? true,
      memberId: item.memberId,
      category: item.category as BudgetRule["category"],
      ageBand: existingRule?.ageBand ?? { fromYears: 0, toYears: 120 },
      monthlyAmount: item.amount,
      annualGrowthPct: existingRule?.annualGrowthPct ?? DEFAULT_ANNUAL_GROWTH_PCT,
      startMonth: item.startMonth ?? undefined,
      endMonth: item.endMonth ?? undefined,
      applyScope: existingRule?.applyScope ?? { scope: "all" },
    };

    if (existingRule) {
      actions.updateBudgetRule(existingRule.id, nextRule);
    } else {
      actions.createBudgetRule(nextRule);
    }
    return;
  }

  const existingDefinition = item.sourceId
    ? eventLibrary.find((definition) => definition.id === item.sourceId)
    : undefined;
  const nextDefinitionId = existingDefinition?.id ?? createEventId();
  const nextTitle = item.notes?.trim() || resolveCategoryLabel(item.category);
  const nextType = item.category as EventType;
  const group = getEventGroup(nextType);

  const nextDefinition: EventDefinition = {
    id: nextDefinitionId,
    title: nextTitle,
    type: nextType,
    kind: "cashflow",
    rule: {
      mode: "params",
      startMonth:
        item.cadence === "recurring" ? item.startMonth ?? "" : item.month ?? "",
      endMonth: item.cadence === "recurring" ? item.endMonth ?? null : null,
      monthlyAmount: item.cadence === "recurring" ? item.amount : 0,
      oneTimeAmount: item.cadence === "oneOff" ? item.amount : 0,
      annualGrowthPct:
        item.cadence === "oneOff"
          ? 0
          : existingDefinition?.rule.annualGrowthPct ?? DEFAULT_ANNUAL_GROWTH_PCT,
    },
    currency: item.currency ?? baseCurrency,
    memberId: item.memberId,
    incomeSubtype:
      group === "income" ? existingDefinition?.incomeSubtype : undefined,
    endAtAgeYears: existingDefinition?.endAtAgeYears,
    templateId: existingDefinition?.templateId,
    templateParams: existingDefinition?.templateParams,
    parentId: existingDefinition?.parentId,
  };

  if (existingDefinition) {
    actions.updateEventDefinition(existingDefinition.id, nextDefinition);
  } else {
    actions.addEventToScenarios(nextDefinition, [scenarioId]);
  }
};

export const removeMoneyItem = (params: {
  item: MoneyItem;
  scenarioId: string;
  actions: {
    removeScenarioEventRef: (scenarioId: string, refId: string) => void;
    removeBudgetRule: (ruleId: string) => void;
  };
}) => {
  const { item, scenarioId, actions } = params;

  if (item.sourceType === "budgetRule" && item.sourceId) {
    actions.removeBudgetRule(item.sourceId);
    return;
  }

  if (item.sourceId) {
    actions.removeScenarioEventRef(scenarioId, item.sourceId);
  }
};

export const buildMoneyCategoryLabelMap = (
  eventTypes: EventDefinition["type"][],
  budgetCategories: BudgetRule["category"][],
  labels: {
    getEventLabel: (type: EventDefinition["type"]) => string;
    getBudgetLabel: (category: BudgetRule["category"]) => string;
  }
) => {
  const map = new Map<string, string>();
  eventTypes.forEach((type) => {
    map.set(type, labels.getEventLabel(type));
  });
  budgetCategories.forEach((category) => {
    map.set(category, labels.getBudgetLabel(category));
  });
  return map;
};

export const buildMoneyCategoryOptions = (params: {
  incomeEventTypes: EventDefinition["type"][];
  expenseEventTypes: EventDefinition["type"][];
  budgetCategories: BudgetRule["category"][];
  labels: {
    getEventLabel: (type: EventDefinition["type"]) => string;
    getBudgetLabel: (category: BudgetRule["category"]) => string;
  };
}) => {
  const { incomeEventTypes, expenseEventTypes, budgetCategories, labels } = params;
  const toOption = (type: EventDefinition["type"]) => ({
    value: type,
    label: labels.getEventLabel(type),
  });
  const incomeOptions = incomeEventTypes.map(toOption);
  const expenseOptions = expenseEventTypes.map(toOption);
  const budgetOptions = budgetCategories.map((category) => ({
    value: category,
    label: labels.getBudgetLabel(category),
  }));

  return {
    incomeOptions,
    expenseOptions,
    budgetOptions,
  };
};

export const resolveMoneyItemCategoryLabel = (
  category: string,
  labelMap: Map<string, string>
) => labelMap.get(category) ?? category;

export const resolveMoneyItemTitle = (
  item: Pick<MoneyItemUpsert, "notes" | "category">,
  labelMap: Map<string, string>
) => item.notes?.trim() || resolveMoneyItemCategoryLabel(item.category, labelMap);
