import type { ProjectionResult } from "@north-star/engine";
import type { AdapterWarning } from "../../src/engine/adapter";
import { projectionToOverviewViewModel } from "../../src/engine/adapter";
import { computeProjectionWithSmartInvest } from "../../src/engine/useProjectionWithLedger";
import type { EventDefinition, ScenarioEventRef } from "../../src/domain/events/types";
import { compilePlanLabDraft } from "../../src/domain/planLab/compilePlanLabDraft";
import type { PlanLabDraft, PlanSnapshot } from "../../src/domain/planLab/types";
import type { CompilerWarning } from "../../src/domain/warnings/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../src/store/scenarioStore";

export type PlanProjectionResult = {
  projection: ProjectionResult | null;
  overview: ReturnType<typeof projectionToOverviewViewModel> | null;
  warnings: AdapterWarning[];
  errors: string[];
};

export type PlanSnapshotValidation = {
  warnings: CompilerWarning[];
};

const applyEventRefOverrides = (
  baseRefs: ScenarioEventRef[] | undefined,
  overrides: ScenarioEventRef[]
) =>
  (baseRefs ?? []).map((ref) => {
    const override = overrides.find((entry) => entry.refId === ref.refId);
    if (!override) {
      return ref;
    }
    return {
      ...ref,
      enabled: override.enabled ?? ref.enabled,
      overrides: {
        ...(ref.overrides ?? {}),
        ...(override.overrides ?? {}),
      },
    };
  });

export const buildPlanLabDraftFromSnapshot = (
  snapshot: PlanSnapshot | null | undefined
): PlanLabDraft => ({
  baselinePatches: snapshot?.baselinePatches,
  experiments: snapshot?.experiments,
  scorecardSettings: snapshot?.scorecardSettings,
});

export const validatePlanSnapshot = (
  snapshot: PlanSnapshot,
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  members: ScenarioMember[],
  budgetRules: BudgetRule[]
): PlanSnapshotValidation => {
  const draft = buildPlanLabDraftFromSnapshot(snapshot);
  const compilation = compilePlanLabDraft(draft, {
    baselineScenario: scenario,
    eventLibrary,
    budgetRules,
    members,
  });
  return {
    warnings: compilation.warnings ?? [],
  };
};

export const getProjectionForPlanSnapshot = (
  snapshot: PlanSnapshot,
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  members: ScenarioMember[],
  budgetRules: BudgetRule[]
): PlanProjectionResult => {
  const draft = buildPlanLabDraftFromSnapshot(snapshot);
  const planLabCompilation = compilePlanLabDraft(draft, {
    baselineScenario: scenario,
    eventLibrary,
    budgetRules,
    members,
  });
  const eventRefsWithOverrides = applyEventRefOverrides(
    scenario.eventRefs,
    planLabCompilation.eventRefOverrides
  );
  const baselineScenario: Scenario = {
    ...scenario,
    assumptions: {
      ...scenario.assumptions,
      ...planLabCompilation.assumptions,
    },
    positions: {
      ...(scenario.positions ?? {}),
      ...planLabCompilation.positions,
    },
    eventRefs: [...eventRefsWithOverrides, ...planLabCompilation.eventRefs],
  };
  const combinedEventLibrary = [
    ...eventLibrary,
    ...planLabCompilation.eventDefinitions,
  ];

  try {
    const {
      projection,
      warnings,
    } = computeProjectionWithSmartInvest(baselineScenario, combinedEventLibrary, {
      members,
      budgetRules,
    });
    return {
      projection,
      overview: projection ? projectionToOverviewViewModel(projection) : null,
      warnings: [...warnings, ...planLabCompilation.warnings],
      errors: [],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown projection error.";
    return {
      projection: null,
      overview: null,
      warnings: [...planLabCompilation.warnings],
      errors: [message],
    };
  }
};
