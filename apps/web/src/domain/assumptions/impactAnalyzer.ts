import type { Scenario, ScenarioAssumptions, ScenarioAsset } from "../../store/scenarioStore";
import type { ScenarioEvent } from "../scenarioV2/events";

export type AssumptionImpactKey =
  | "inflationRate"
  | "salaryGrowthRate"
  | "rentAnnualGrowthPct"
  | "propertyAppreciationPct"
  | "cashYieldPct"
  | "carDepreciationRatePct";

export type AssumptionImpactOverrides = Partial<Pick<
  ScenarioAssumptions,
  AssumptionImpactKey
>>;

export type AssumptionImpactAnalysis = {
  byAssumptionKey: Partial<Record<AssumptionImpactKey, { eventIds: string[]; count: number }>>;
  byEventId: Record<string, AssumptionImpactKey[]>;
  summary: {
    totalImpactedEventCount: number;
    distribution: {
      income: number;
      expense: number;
      housing: number;
    };
  };
};

const RECURRING_CADENCE = new Set(["monthly", "quarterly", "yearly", "everyNMonths"]);

const hasAssumptionOverride = (
  overrides: AssumptionImpactOverrides,
  key: AssumptionImpactKey
): boolean => overrides[key] !== undefined;

const resolveHousingAssumptionKey = (
  assumptions: ScenarioAssumptions
): "rentAnnualGrowthPct" | "inflationRate" =>
  assumptions.rentAnnualGrowthPct !== undefined ? "rentAnnualGrowthPct" : "inflationRate";

const pushImpact = (
  map: Map<AssumptionImpactKey, Set<string>>,
  assumptionKey: AssumptionImpactKey,
  entityId: string
): void => {
  const bucket = map.get(assumptionKey) ?? new Set<string>();
  bucket.add(entityId);
  map.set(assumptionKey, bucket);
};

const mapEventImpacts = (
  scenario: Pick<Scenario, "assumptions" | "events">,
  overrides: AssumptionImpactOverrides,
  impactByAssumption: Map<AssumptionImpactKey, Set<string>>
): void => {
  (scenario.events ?? []).forEach((event) => {
    if (event.type === "cashflow") {
      const isRecurring = RECURRING_CADENCE.has(event.cadence);
      if (!isRecurring || event.growthMode !== "assumption") {
        return;
      }
      if (event.kind === "income" && hasAssumptionOverride(overrides, "salaryGrowthRate")) {
        pushImpact(impactByAssumption, "salaryGrowthRate", event.id);
      }
      if (event.kind === "expense" && hasAssumptionOverride(overrides, "inflationRate")) {
        pushImpact(impactByAssumption, "inflationRate", event.id);
      }
      return;
    }

    if (event.type === "housing" && event.rentGrowthMode === "assumption") {
      const assumptionKey = resolveHousingAssumptionKey(scenario.assumptions);
      if (hasAssumptionOverride(overrides, assumptionKey)) {
        pushImpact(impactByAssumption, assumptionKey, event.id);
      }
    }
  });
};

const mapAssetImpacts = (
  assets: ScenarioAsset[] | undefined,
  overrides: AssumptionImpactOverrides,
  impactByAssumption: Map<AssumptionImpactKey, Set<string>>
): void => {
  (assets ?? []).forEach((asset) => {
    if (asset.kind === "home" && hasAssumptionOverride(overrides, "propertyAppreciationPct")) {
      pushImpact(impactByAssumption, "propertyAppreciationPct", asset.id);
    }
    if (asset.kind === "cash" && hasAssumptionOverride(overrides, "cashYieldPct")) {
      pushImpact(impactByAssumption, "cashYieldPct", asset.id);
    }
    if (
      (asset.kind === "car" || asset.depreciationSource === "carDepreciation") &&
      hasAssumptionOverride(overrides, "carDepreciationRatePct")
    ) {
      pushImpact(impactByAssumption, "carDepreciationRatePct", asset.id);
    }
  });
};

const buildDistribution = (
  events: ScenarioEvent[] | undefined,
  impactedEventIds: Set<string>
): AssumptionImpactAnalysis["summary"]["distribution"] => {
  let income = 0;
  let expense = 0;
  let housing = 0;

  (events ?? []).forEach((event) => {
    if (!impactedEventIds.has(event.id)) {
      return;
    }
    if (event.type === "housing") {
      housing += 1;
      return;
    }
    if (event.type === "cashflow") {
      if (event.kind === "income") {
        income += 1;
      }
      if (event.kind === "expense") {
        expense += 1;
      }
    }
  });

  return { income, expense, housing };
};

export const analyzeAssumptionImpact = (
  scenario: Pick<Scenario, "assumptions" | "events" | "assets" | "liabilities">,
  overrides: AssumptionImpactOverrides
): AssumptionImpactAnalysis => {
  const impactByAssumption = new Map<AssumptionImpactKey, Set<string>>();

  mapEventImpacts(scenario, overrides, impactByAssumption);
  mapAssetImpacts(scenario.assets, overrides, impactByAssumption);

  const byAssumptionKey: AssumptionImpactAnalysis["byAssumptionKey"] = {};
  const byEventId: AssumptionImpactAnalysis["byEventId"] = {};

  impactByAssumption.forEach((eventIds, assumptionKey) => {
    const ids = Array.from(eventIds);
    byAssumptionKey[assumptionKey] = {
      eventIds: ids,
      count: ids.length,
    };

    ids.forEach((eventId) => {
      byEventId[eventId] = byEventId[eventId] ?? [];
      byEventId[eventId].push(assumptionKey);
    });
  });

  const impactedEventIds = new Set(Object.keys(byEventId));

  return {
    byAssumptionKey,
    byEventId,
    summary: {
      totalImpactedEventCount: impactedEventIds.size,
      distribution: buildDistribution(scenario.events, impactedEventIds),
    },
  };
};
