import { ensureEventSchemaMarker } from "@north-star/adapters";
import { defaultCurrency } from "../../../lib/i18n";
import type {
  ScenarioAssumptions,
  ScenarioClientComputed,
  ScenarioMeta,
} from "../../store/scenarioStore";
import type { ScenarioEvent } from "../scenarioV2/events";
import { dedupeGeneratedAndManual } from "./rules/dedupeGeneratedAndManual";
import { deriveFromProperty } from "./rules/deriveFromProperty";
import {
  deriveScenarioLifecycleState,
  type ScenarioLifecycleSource,
} from "./lifecycle";
import { validateScenarioDraftV3 } from "./validateScenarioDraftV3";
import type { ScenarioCreatePayload, ScenarioDraftV3 } from "./types";

const DEFAULT_ASSUMPTIONS: ScenarioAssumptions = {
  horizonMonths: 360,
  initialCash: 0,
  baseMonth: null,
  includeBudgetRulesInProjection: true,
  inflationRate: 2,
  salaryGrowthRate: 3,
  emergencyFundMonths: 6,
  mortgageRatePct: 3.5,
  mortgageTermYears: 30,
  rentMonthly: 15000,
  rentAnnualGrowthPct: 2,
  propertyAppreciationPct: 3,
  carDepreciationRatePct: 15,
  cashYieldPct: 1,
  taxInputMode: "gross",
};

export type CompileScenarioContext = {
  assumptionsBase?: ScenarioAssumptions;
  metaBase?: ScenarioMeta;
  clientComputedBase?: ScenarioClientComputed;
  nowIso?: string;
  lifecycleSource?: ScenarioLifecycleSource;
};

export const compileScenarioCreatePayload = (
  draft: ScenarioDraftV3,
  context: CompileScenarioContext = {}
): ScenarioCreatePayload => {
  const { normalizedDraft, issues } = validateScenarioDraftV3(draft);
  const nowIso = context.nowIso ?? new Date().toISOString();

  const assumptions: ScenarioAssumptions = {
    ...(context.assumptionsBase ?? DEFAULT_ASSUMPTIONS),
    ...(normalizedDraft.assumptions ?? {}),
    baseMonth:
      normalizedDraft.assumptions?.baseMonth ??
      normalizedDraft.profile?.startMonth ??
      context.assumptionsBase?.baseMonth ??
      null,
    horizonMonths:
      normalizedDraft.assumptions?.horizonMonths ??
      normalizedDraft.profile?.horizonMonths ??
      context.assumptionsBase?.horizonMonths ??
      DEFAULT_ASSUMPTIONS.horizonMonths,
    salaryGrowthRate:
      normalizedDraft.assumptions?.salaryGrowthRate ??
      normalizedDraft.income?.salaryGrowthRatePct ??
      context.assumptionsBase?.salaryGrowthRate ??
      DEFAULT_ASSUMPTIONS.salaryGrowthRate,
  };

  const rawEventsPayload = ensureEventSchemaMarker({
    events: normalizedDraft.events ?? [],
  });

  const derived = deriveFromProperty(normalizedDraft);
  const mergedEvents = dedupeGeneratedAndManual([
    ...(Array.isArray(rawEventsPayload.events)
      ? (rawEventsPayload.events as ScenarioEvent[])
      : []),
    ...(derived.events as ScenarioEvent[]),
  ]);

  const lifecycle = context.lifecycleSource
    ? deriveScenarioLifecycleState({
        source: context.lifecycleSource,
        meta: normalizedDraft.meta,
        clientComputed: normalizedDraft.clientComputed,
        nowIso,
      })
    : {
        meta: normalizedDraft.meta ?? {},
        clientComputed: normalizedDraft.clientComputed ?? {},
      };

  return {
    assumptions,
    members: normalizedDraft.members ?? [],
    assets: normalizedDraft.assets ?? [],
    liabilities: [...(normalizedDraft.liabilities ?? []), ...(derived.liabilities ?? [])],
    events: mergedEvents,
    meta: {
      ...(context.metaBase ?? {}),
      ...lifecycle.meta,
      schemaVersion: 2,
      lastSavedAt: nowIso,
    },
    clientComputed: {
      ...(context.clientComputedBase ?? {}),
      ...lifecycle.clientComputed,
    },
    baseCurrency: normalizedDraft.baseCurrency ?? defaultCurrency,
    validationIssues: issues,
  };
};
