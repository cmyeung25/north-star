import type { ProjectionInput } from "@north-star/engine";
import { addMonths } from "../domain/members/age";
import { mapScenarioToEngineInput } from "./adapter";
import { isValidMonthKey, compareMonthKey } from "../utils/monthKey";
import type { EventDefinition } from "../domain/events/types";
import type { CashflowEvent, ScenarioEvent } from "../domain/scenarioV2/events";
import type { EventType } from "../features/timeline/schema";
import type {
  Scenario,
  ScenarioAssumptions,
  ScenarioMember,
  ScenarioMeta,
  ScenarioAsset,
  ScenarioLiability,
} from "../store/scenarioStore";

export type LedgerRow = {
  month: string;
  amount: number;
  sourceEventId: string;
  label?: string;
  memberId?: string;
  tags?: string[];
  kind?: "income" | "expense";
};

export type ScenarioV2 = {
  id: string;
  name: string;
  baseCurrency: string;
  updatedAt: number;
  assumptions: ScenarioAssumptions;
  members?: ScenarioMember[];
  assets?: ScenarioAsset[];
  liabilities?: ScenarioLiability[];
  events?: ScenarioEvent[];
  meta?: ScenarioMeta;
};

const resolveHorizonEndMonth = (
  assumptions: ScenarioAssumptions
): string | null => {
  const baseMonth = assumptions.baseMonth;
  const horizonMonths = assumptions.horizonMonths;
  if (!baseMonth || !isValidMonthKey(baseMonth) || !Number.isFinite(horizonMonths)) {
    return null;
  }
  return addMonths(baseMonth, Math.max(horizonMonths - 1, 0));
};

const normalizeAmount = (event: CashflowEvent) => {
  const raw = Number(event.amount);
  if (!Number.isFinite(raw)) {
    return 0;
  }
  const sign = event.kind === "expense" ? -1 : 1;
  return Math.abs(raw) * sign;
};

const buildCashflowMonths = (
  event: CashflowEvent,
  assumptions: ScenarioAssumptions
): string[] => {
  if (event.cadence === "oneOff") {
    if (event.occurrenceMonth && isValidMonthKey(event.occurrenceMonth)) {
      return [event.occurrenceMonth];
    }
    return [];
  }

  if (!event.startMonth || !isValidMonthKey(event.startMonth)) {
    return [];
  }

  const horizonEndMonth = resolveHorizonEndMonth(assumptions);
  const endMonth =
    event.endMonth && isValidMonthKey(event.endMonth)
      ? event.endMonth
      : horizonEndMonth;

  if (!endMonth || compareMonthKey(event.startMonth, endMonth) > 0) {
    return [];
  }

  const stepMonths =
    event.cadence === "monthly"
      ? 1
      : event.cadence === "quarterly"
      ? 3
      : event.cadence === "yearly"
      ? 12
      : event.everyNMonths ?? 1;

  const months: string[] = [];
  let current = event.startMonth;
  while (compareMonthKey(current, endMonth) <= 0) {
    months.push(current);
    current = addMonths(current, stepMonths);
  }

  return months;
};

export const compileScenarioV2ToLedger = (
  scenario: ScenarioV2
): LedgerRow[] => {
  const events = scenario.events ?? [];
  const assumptions = scenario.assumptions;

  return events.flatMap((event) => {
    if (event.type !== "cashflow") {
      if (event.type !== "adjustment") {
        return [];
      }
      if (!isValidMonthKey(event.month)) {
        return [];
      }
      const rawAmount = Number(event.amount);
      if (!Number.isFinite(rawAmount) || rawAmount === 0) {
        return [];
      }
      return [
        {
          month: event.month,
          amount: rawAmount,
          sourceEventId: event.id,
          label: event.label,
          memberId: event.memberId,
          tags: event.tags ? [...event.tags] : undefined,
          kind: rawAmount < 0 ? "expense" : "income",
        },
      ];
    }
    const months = buildCashflowMonths(event, assumptions);
    if (months.length === 0) {
      return [];
    }
    const amount = normalizeAmount(event);
    if (!Number.isFinite(amount) || amount === 0) {
      return [];
    }

    return months.map((month) => ({
      month,
      amount,
      sourceEventId: event.id,
      label: event.label,
      memberId: event.memberId,
      tags: event.tags ? [...event.tags] : undefined,
      kind: event.kind,
    }));
  });
};

const buildLegacyScenarioShell = (
  scenario: ScenarioV2
): Scenario => ({
  id: scenario.id,
  name: scenario.name,
  baseCurrency: scenario.baseCurrency,
  updatedAt: scenario.updatedAt,
  version: 2,
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Medium",
  },
  assumptions: scenario.assumptions,
  eventRefs: [],
  milestoneEvents: [],
  snapshots: [],
  plans: [],
  meta: scenario.meta,
});

const buildEventTypeForKind = (kind: CashflowEvent["kind"]): EventType =>
  kind === "income" ? "salary" : "custom";

const buildLegacyEventLibrary = (
  scenario: ScenarioV2
): EventDefinition[] => {
  const assumptions = scenario.assumptions;
  const events = scenario.events ?? [];
  const horizonEndMonth = resolveHorizonEndMonth(assumptions);

  return events.flatMap((event) => {
    if (event.type !== "cashflow") {
      return [];
    }
    const months = buildCashflowMonths(event, assumptions);
    if (months.length === 0) {
      return [];
    }

    const type = buildEventTypeForKind(event.kind);
    const schedule = months.map((month) => ({
      month,
      amount: Math.abs(event.amount),
    }));

    return [
      {
        id: event.id,
        title: event.label ?? "Cashflow",
        type,
        kind: "cashflow",
        rule: {
          mode: "schedule",
          startMonth: event.startMonth ?? event.occurrenceMonth ?? horizonEndMonth ?? "",
          endMonth: event.endMonth ?? null,
          schedule,
        },
        currency: scenario.baseCurrency,
        memberId: event.memberId,
      },
    ];
  });
};

export const compileScenarioV2ToProjectionInput = (
  scenario: ScenarioV2
): ProjectionInput => {
  const shellScenario = buildLegacyScenarioShell(scenario);
  const eventLibrary = buildLegacyEventLibrary(scenario);
  const scenarioWithEvents = {
    ...shellScenario,
    eventRefs: eventLibrary.map((definition) => ({
      refId: definition.id,
      enabled: true,
    })),
  };
  const { input } = mapScenarioToEngineInput(scenarioWithEvents, eventLibrary);
  return input;
};
